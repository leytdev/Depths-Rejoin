import { DepthsClient } from "./client/DepthsClient";
import { token } from "./config";

new DepthsClient().start(token);
