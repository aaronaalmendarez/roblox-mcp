import { HttpService, LogService } from "@rbxts/services";

const StudioTestService = game.GetService("StudioTestService");
const ServerScriptService = game.GetService("ServerScriptService");

const STOP_LISTENER_NAME = "__MCP_StopListener";

interface OutputEntry {
	message: string;
	messageType: string;
	timestamp: number;
}

let testRunning = false;
let outputBuffer: OutputEntry[] = [];
let logConnection: RBXScriptConnection | undefined;
let testResult: unknown;
let testError: string | undefined;
let stopListenerScript: Script | undefined;

function buildStopListenerSource(port: number): string {
	return `local HttpService = game:GetService("HttpService")
local StudioTestService = game:GetService("StudioTestService")
while true do
	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = "http://127.0.0.1:${port}/playtest-stop-signal",
			Method = "GET",
		})
	end)
	if ok and res.Success then
		local dok, data = pcall(function()
			return HttpService:JSONDecode(res.Body)
		end)
		if dok and data.shouldStop then
			pcall(function() StudioTestService:EndTest("stopped_by_mcp") end)
			return
		end
	end
	task.wait(1)
end`;
}

function cleanupStopListener() {
	if (stopListenerScript) {
		pcall(() => stopListenerScript!.Destroy());
		stopListenerScript = undefined;
	}
}

function startPlaytest(requestData: Record<string, unknown>) {
	const mode = requestData.mode as string | undefined;
	const serverPort = requestData.serverPort as number | undefined;

	if (mode !== "play" && mode !== "run") {
		return { error: 'mode must be "play" or "run"' };
	}

	if (testRunning) {
		return { error: "A test is already running" };
	}

	testRunning = true;
	outputBuffer = [];
	testResult = undefined;
	testError = undefined;

	cleanupStopListener();

	if (serverPort !== undefined && serverPort > 0) {
		// HttpEnabled is typed readonly but writable from plugin context
		(HttpService as unknown as { HttpEnabled: boolean }).HttpEnabled = true;

		const listener = new Instance("Script");
		listener.Name = STOP_LISTENER_NAME;
		listener.Source = buildStopListenerSource(serverPort);
		listener.Parent = ServerScriptService;
		stopListenerScript = listener;
	}

	logConnection = LogService.MessageOut.Connect((message, messageType) => {
		outputBuffer.push({
			message,
			messageType: messageType.Name,
			timestamp: tick(),
		});
	});

	task.spawn(() => {
		const [ok, result] = pcall(() => {
			if (mode === "play") {
				return StudioTestService.ExecutePlayModeAsync({});
			}
			return StudioTestService.ExecuteRunModeAsync({});
		});

		if (ok) {
			testResult = result;
		} else {
			testError = tostring(result);
		}

		if (logConnection) {
			logConnection.Disconnect();
			logConnection = undefined;
		}
		testRunning = false;

		cleanupStopListener();
	});

	return { success: true, message: `Playtest started in ${mode} mode` };
}

function stopPlaytest(_requestData: Record<string, unknown>) {
	if (!testRunning) {
		return { error: "No test is currently running" };
	}

	return {
		success: true,
		output: [...outputBuffer],
		outputCount: outputBuffer.size(),
		message: "Stop signal sent. The play session will end shortly.",
	};
}

function getPlaytestOutput(_requestData: Record<string, unknown>) {
	return {
		isRunning: testRunning,
		output: [...outputBuffer],
		outputCount: outputBuffer.size(),
		testResult: testResult !== undefined ? tostring(testResult) : undefined,
		testError,
	};
}

export = {
	startPlaytest,
	stopPlaytest,
	getPlaytestOutput,
};
