import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import type { RunnerControlMessage, RunnerHeartbeatResponse, RunnerRegisterResponse } from "@agent-flow/shared";
import { RunnerService } from "./runner.service";

@Controller("runner")
export class RunnerController {
  constructor(@Inject(RunnerService) private readonly runnerService: RunnerService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body() message: Extract<RunnerControlMessage, { type: "runner_register" }>,
  ): Promise<RunnerRegisterResponse> {
    return this.runnerService.register(message);
  }

  @Post("heartbeat")
  @HttpCode(HttpStatus.CREATED)
  heartbeat(
    @Body() message: Extract<RunnerControlMessage, { type: "runner_heartbeat" }>,
  ): Promise<RunnerHeartbeatResponse> {
    return this.runnerService.heartbeat(message);
  }
}
