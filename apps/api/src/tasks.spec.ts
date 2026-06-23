import "reflect-metadata";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

describe("tasks API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a task and runs the simulated V0 agent workflow", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/tasks")
      .send({
        title: "增加邮箱登录流程",
        prompt: "增加登录页面，支持邮箱和密码登录。",
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      title: "增加邮箱登录流程",
      prompt: "增加登录页面，支持邮箱和密码登录。",
      status: "completed",
    });

    const taskId = createResponse.body.id as string;

    const taskResponse = await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .expect(200);
    expect(taskResponse.body.id).toBe(taskId);

    const eventsResponse = await request(app.getHttpServer())
      .get(`/tasks/${taskId}/events`)
      .expect(200);
    expect(eventsResponse.body.map((event: { type: string }) => event.type)).toEqual([
      "task_created",
      "agent_started",
      "artifact_created",
      "agent_completed",
      "agent_started",
      "artifact_created",
      "agent_completed",
      "agent_started",
      "artifact_created",
      "agent_completed",
      "agent_started",
      "artifact_created",
      "agent_completed",
      "agent_started",
      "artifact_created",
      "agent_completed",
      "task_completed",
    ]);

    const artifactsResponse = await request(app.getHttpServer())
      .get(`/tasks/${taskId}/artifacts`)
      .expect(200);
    expect(artifactsResponse.body.map((artifact: { kind: string }) => artifact.kind)).toEqual([
      "plan",
      "patch",
      "review",
      "test_log",
      "final_report",
    ]);
  });

  it("lists tasks and returns 404 for unknown task ids", async () => {
    await request(app.getHttpServer())
      .post("/tasks")
      .send({ title: "任务 A", prompt: "实现 A" })
      .expect(201);

    const listResponse = await request(app.getHttpServer()).get("/tasks").expect(200);
    expect(listResponse.body).toHaveLength(1);

    await request(app.getHttpServer()).get("/tasks/missing").expect(404);
  });

  it("exposes an SSE stream endpoint for task events", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/tasks")
      .send({ title: "任务 B", prompt: "实现 B" })
      .expect(201);

    const streamResponse = await request(app.getHttpServer())
      .get(`/tasks/${createResponse.body.id}/stream`)
      .set("Accept", "text/event-stream")
      .buffer(false)
      .expect(200);

    expect(streamResponse.headers["content-type"]).toContain("text/event-stream");
  });
});
