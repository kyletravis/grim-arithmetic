var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.1.1",
	authors: [{ name: "Kyle Travis" }],
	compatibility: {
		minimum: "13",
		verified: "13"
	},
	system: ["pf2e"],
	relationships: { systems: [{
		id: "pf2e",
		type: "system"
	}] },
	esmodules: ["dist/grim-arithmetic.js"],
	styles: ["styles/grim-arithmetic.css"],
	templates: ["templates/mortality-panel.hbs"]
}, t = "grim-arithmetic", n = "Grim Arithmetic", r = e.version;
//#endregion
//#region src/debug-capture.ts
function i(e) {
	let t = e.actor, n = l(t?.system);
	return {
		token: {
			id: e.id,
			name: e.name,
			disposition: e.document?.disposition
		},
		actor: t ? {
			id: t.id,
			name: t.name,
			type: t.type,
			system: {
				attributes: o(n),
				saves: n.saves,
				traits: n.traits
			},
			itemTypes: s(t.itemTypes),
			meleeItems: c(t.items).filter((e) => e.type === "melee").map((e) => ({
				id: e.id,
				name: e.name,
				type: e.type,
				system: {
					bonus: l(e.system).bonus,
					attack: l(e.system).attack,
					damageRolls: l(e.system).damageRolls,
					traits: l(e.system).traits
				}
			}))
		} : null
	};
}
function a(e) {
	let t = i(e);
	return console.log("Grim Arithmetic | Debug capture", t), t;
}
function o(e) {
	let t = l(e.attributes);
	return {
		hp: t.hp,
		ac: t.ac
	};
}
function s(e) {
	return { condition: l(e).condition };
}
function c(e) {
	if (Array.isArray(e)) return e.filter(u);
	let t = l(e).contents;
	if (Array.isArray(t)) return t.filter(u);
	if (u(e) && typeof e.filter == "function") {
		let t = e.filter(u);
		return Array.isArray(t) ? t.filter(u) : [];
	}
	return [];
}
function l(e) {
	return u(e) ? e : {};
}
function u(e) {
	return typeof e == "object" && !!e;
}
//#endregion
//#region src/settings.ts
function d() {
	game.settings.register(t, "defaultStrikes", {
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
	}), game.settings.register(t, "debugLogging", {
		name: "Debug logging",
		hint: "Log Grim Arithmetic debug information to the browser console.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	});
}
//#endregion
//#region src/foundry/selection.ts
function f() {
	return p({
		controlled: canvas.tokens?.controlled,
		targets: game.user?.targets
	});
}
function p(e) {
	let t = e.controlled ?? [], n = Array.from(e.targets ?? []), r = [], i = t.length === 1 ? t[0] : null, a = n.length === 1 ? n[0] : null;
	return t.length === 0 && r.push("No PC token selected. Select one PC token."), t.length > 1 && r.push("Multiple tokens selected. Select only one PC token."), n.length === 0 && r.push("No target selected. Target one enemy token."), n.length > 1 && r.push("Multiple targets selected. Target only one enemy token."), {
		subjectToken: i,
		enemyToken: a,
		errors: r
	};
}
//#endregion
//#region src/systems/pf2e-adapter.ts
var m = -1, h = class {
	id = "pf2e";
	label = "Pathfinder Second Edition";
	getCombatantFromToken(e) {
		let t = e.actor;
		if (!t) return null;
		let n = S(t.system), r = S(n.attributes), i = S(r.hp), a = S(r.ac), o = i.value, s = i.max, c = a.value;
		if (!w(o) || !w(s) || !w(c)) return null;
		let l = S(n.saves), u = S(S(n.resources).heroPoints), d = S(n.traits);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: g(e, t),
			hp: {
				current: o,
				max: s,
				temp: T(i.temp)
			},
			defenses: {
				ac: c,
				fort: T(S(l.fortitude).value),
				reflex: T(S(l.reflex).value),
				will: T(S(l.will).value)
			},
			deathState: {
				dying: _(t, "dying"),
				wounded: _(t, "wounded"),
				doomed: _(t, "doomed"),
				heroPoints: T(u.value)
			},
			traits: D(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return v(t).filter((e) => e.type === "melee").map((e) => {
			let t = S(e.system), n = b(t), r = x(t);
			if (!w(n) || typeof r != "string") return null;
			let i = D(S(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: r,
				traits: i,
				mapType: i.includes("agile") ? "agile" : "normal",
				assumptions: ["PF2e Strike extraction is first-pass and may miss conditional modifiers."]
			};
		}).filter((e) => e !== null);
	}
};
function g(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === m ? "enemy" : "neutral";
}
function _(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? T(n.value) ?? T(S(S(n.system).value).value) ?? 0 : 0;
}
function v(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(y);
	let n = S(t).contents;
	if (Array.isArray(n)) return n.filter(y);
	if (C(t) && typeof t.filter == "function") {
		let e = t.filter(y);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function y(e) {
	return C(e);
}
function b(e) {
	return E(S(e.bonus).value) ?? E(S(e.attack).value);
}
function x(e) {
	let t = S(e.damageRolls), n = Object.values(t).find(C);
	if (!n) return;
	let r = n.damage, i = n.formula;
	if (typeof r == "string") return r;
	if (typeof i == "string") return i;
}
function S(e) {
	return C(e) ? e : {};
}
function C(e) {
	return typeof e == "object" && !!e;
}
function w(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function T(e) {
	return w(e) ? e : void 0;
}
function E(e) {
	if (w(e)) return e;
	if (typeof e != "string") return;
	let t = Number(e.trim().replace(/^\+/, ""));
	return w(t) ? t : void 0;
}
function D(e) {
	return Array.isArray(e) ? e.map((e) => {
		if (typeof e == "string") return e;
		let t = S(e).slug;
		return typeof t == "string" ? t : null;
	}).filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/engine/degree-of-success.ts
var O = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function k(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? A(i, 1) : t === 1 ? A(i, -1) : i;
}
function A(e, t) {
	let n = O.indexOf(e);
	return O[Math.max(0, Math.min(O.length - 1, n + t))];
}
//#endregion
//#region src/engine/attack-probability.ts
function ee(e) {
	let t = {
		criticalSuccess: 0,
		success: 0,
		failure: 0,
		criticalFailure: 0
	};
	for (let n = 1; n <= 20; n += 1) {
		let r = k({
			die: n,
			total: n + e.attackBonus,
			dc: e.ac
		});
		t[r] += 1;
	}
	return {
		criticalSuccess: t.criticalSuccess / 20,
		success: t.success / 20,
		failure: t.failure / 20,
		criticalFailure: t.criticalFailure / 20
	};
}
//#endregion
//#region src/engine/dice.ts
function te(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return (t.match(/[+-]?[^+-]+/g) ?? []).reduce((e, t) => e + j(t), 0);
}
function j(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (r) {
		let e = Number(r[1]), n = Number(r[2]);
		return t * e * ((n + 1) / 2);
	}
	return t * Number(n);
}
//#endregion
//#region src/engine/mortality.ts
function M(e) {
	let t = te(e.damageFormula), n = N(e.mapType).slice(0, e.strikes), r = [], i = [], a = 0, o = new Map([[0, 1]]);
	for (let s of n) {
		let n = ee({
			attackBonus: e.attackBonus + s,
			ac: e.ac
		});
		r.push(n.success), i.push(n.criticalSuccess);
		let c = t, l = t * 2, u = n.failure + n.criticalFailure;
		a += n.success * c + n.criticalSuccess * l, o = P(o, [
			{
				damage: 0,
				probability: u
			},
			{
				damage: c,
				probability: n.success
			},
			{
				damage: l,
				probability: n.criticalSuccess
			}
		]);
	}
	let s = I(F(o, e.hp));
	return {
		downProbability: s,
		expectedHpAfterTurn: Math.max(0, e.hp - a),
		hitChanceByStrike: r,
		critChanceByStrike: i,
		riskLabel: L(s),
		topRiskDrivers: R(s, i),
		assumptions: [
			"Uses average damage, not full dice distribution.",
			"Critical damage is modeled as simple double damage.",
			`Enemy turn model: ${e.strikes} Strike${e.strikes === 1 ? "" : "s"}.`,
			`MAP model: ${e.mapType}.`
		],
		notModeled: [
			"Resistance, weakness, and immunity.",
			"Deadly, fatal, precision, splash, and persistent damage.",
			"Reactions such as Shield Block or Champion reactions.",
			"Healing before or during the enemy turn.",
			"Permanent death probability."
		]
	};
}
function N(e) {
	return e === "agile" ? [
		0,
		-4,
		-8
	] : e === "none" ? [
		0,
		0,
		0
	] : [
		0,
		-5,
		-10
	];
}
function P(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function F(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function I(e) {
	return Math.max(0, Math.min(1, e));
}
function L(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function R(e, t) {
	if (e === 0) return ["No average hit or crit in the selected sequence downs the PC."];
	let n = Math.max(...t);
	return [`Down risk is primarily crit-driven; highest strike crit chance is ${Math.round(n * 100)}%.`];
}
//#endregion
//#region src/ui/panel-data.ts
var z = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	attackId: ""
}, B = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function V({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: B,
		errors: e.errors,
		controls: H(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = W(o, n.attackId), c = U(i, a, s), l = H(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: B,
		errors: c,
		controls: l
	};
	let u = G(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = M({
		hp: f,
		ac: d,
		attackBonus: s.attackBonus,
		damageFormula: s.damageFormula,
		strikes: n.strikes,
		mapType: u
	}), m = [...s.assumptions, ...p.assumptions];
	return n.shieldBonus > 0 && m.push(`Applies a +${n.shieldBonus} shield/status AC adjustment.`), n.woundedOverride !== "current" && m.push(`Displays wounded override ${n.woundedOverride}; down-risk math does not use wounded yet.`), {
		moduleVersion: r,
		message: "Immediate down-risk estimate based on the selected PC and targeted enemy.",
		permanentDeath: B,
		errors: [],
		controls: l,
		subject: i,
		enemy: a,
		attack: s,
		risk: {
			downPercent: q(p.downProbability),
			expectedHpAfterTurn: p.expectedHpAfterTurn.toFixed(1),
			riskLabel: p.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: K(i, n.woundedOverride),
			strikeChances: p.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: q(e),
				critPercent: q(p.critChanceByStrike[t] ?? 0)
			})),
			assumptions: m,
			notModeled: p.notModeled
		}
	};
}
function H(e, t, n = e.attackId) {
	let r = t.some((e) => e.id === n) ? n : t[0]?.id ?? "";
	return {
		strikes: [
			"1",
			"2",
			"3"
		].map((t) => ({
			value: t,
			label: `${t} Strike${t === "1" ? "" : "s"}`,
			selected: String(e.strikes) === t
		})),
		attacks: t.map((e) => ({
			value: e.id,
			label: `${e.name} — +${e.attackBonus}, ${e.damageFormula}`,
			selected: e.id === r
		})),
		mapMode: [
			["auto", "Auto"],
			["normal", "Normal"],
			["agile", "Agile"],
			["none", "None"]
		].map(([t, n]) => ({
			value: t,
			label: n,
			selected: e.mapMode === t
		})),
		shieldBonus: [
			"0",
			"1",
			"2"
		].map((t) => ({
			value: t,
			label: t === "0" ? "No shield bonus" : `+${t} AC`,
			selected: String(e.shieldBonus) === t
		})),
		woundedOverride: [
			"current",
			"0",
			"1",
			"2",
			"3"
		].map((t) => ({
			value: t,
			label: t === "current" ? "Current actor value" : `Wounded ${t}`,
			selected: e.woundedOverride === t
		}))
	};
}
function U(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function W(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function G(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function K(e, t) {
	return t === "current" ? `Current actor wounded value: ${e.deathState?.wounded ?? 0}` : `Override displayed: Wounded ${t}`;
}
function q(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/ui/mortality-panel.ts
var J = class extends Application {
	controls = { ...z };
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-panel`,
			title: n,
			template: `modules/${t}/templates/mortality-panel.hbs`,
			width: 500,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	constructor(e) {
		super(e), this.controls.strikes = X(Y("defaultStrikes", 2));
	}
	async getData() {
		return V({
			selection: f(),
			adapter: new h(),
			controls: this.controls,
			moduleVersion: r
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = re(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = X(Number(t))), e === "mapMode" && (this.controls.mapMode = Z(t)), e === "shieldBonus" && (this.controls.shieldBonus = Q(t)), e === "woundedOverride" && (this.controls.woundedOverride = ne(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function Y(e, n) {
	let r = game.settings.get(t, e);
	return typeof r == "number" ? r : n;
}
function X(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function Z(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function Q(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function ne(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function re(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/token-controls.ts
var $ = `${t}-open-panel`;
function ie() {
	new J().render(!0);
}
function ae() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[$] = {
			name: $,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: ie
		});
	});
}
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), d(), ae();
}), Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let e = game.modules.get(t);
	e && (e.api = {
		openPanel: () => new J().render(!0),
		captureTokenDebug: (e = canvas.tokens?.controlled?.[0]) => a(e)
	});
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map