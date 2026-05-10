//#region src/constants.ts
var e = "grim-arithmetic", t = "Grim Arithmetic";
//#endregion
//#region src/settings.ts
function n() {
	game.settings.register(e, "defaultStrikes", {
		name: "Default enemy Strike count",
		hint: "Default number of Strikes used for immediate-threat estimates.",
		scope: "world",
		config: !0,
		type: Number,
		default: 2,
		choices: {
			1: "1 Strike",
			2: "2 Strikes",
			3: "3 Strikes"
		}
	}), game.settings.register(e, "debugLogging", {
		name: "Debug logging",
		hint: "Log Grim Arithmetic debug information to the browser console.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	});
}
//#endregion
//#region src/main.ts
Hooks.once("init", () => {
	console.log(`${t} | Initializing`), n();
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map