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
//#region src/ui/mortality-panel.ts
var r = class extends Application {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${e}-panel`,
			title: t,
			template: `modules/${e}/templates/mortality-panel.hbs`,
			width: 420,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	async getData() {
		return {
			message: "Select a PC token and target one enemy token to estimate immediate down risk.",
			permanentDeath: "Permanent death probability is planned for a future milestone and is not modeled in MVP."
		};
	}
};
//#endregion
//#region src/ui/token-controls.ts
function i() {
	Hooks.on("getSceneControlButtons", (t) => {
		if (!game.user?.isGM) return;
		let n = t.find((e) => e.name === "token");
		n && n.tools.push({
			name: `${e}-open-panel`,
			title: "Grim Arithmetic",
			icon: "fas fa-skull",
			button: !0,
			onClick: () => new r().render(!0)
		});
	});
}
Hooks.once("init", () => {
	console.log(`${t} | Initializing`), n(), i();
}), Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let t = game.modules.get(e);
	t && (t.api = { openPanel: () => new r().render(!0) });
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map