const { registerPlugin } = await import("@capacitor/core");
const Progress = registerPlugin("ProgressNotification");
const result = await Progress.checkStatus();
console.log(result); // Should say { status: "implemented" }