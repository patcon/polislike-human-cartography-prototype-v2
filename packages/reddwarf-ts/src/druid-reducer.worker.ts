import type { ReducerRequest, ReducerResponse } from "./druid-reducer";
import { runReducer } from "./druid-reducer";

self.onmessage = (e: MessageEvent<ReducerRequest>) => {
  const req = e.data;
  if (req?.type !== "reduce") return;
  try {
    for (const event of runReducer(req)) {
      self.postMessage(event);
    }
  } catch (err) {
    const response: ReducerResponse = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
