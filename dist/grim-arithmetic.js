var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.2.0",
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
		let n = x(t.system), r = x(n.attributes), i = x(r.hp), a = x(r.ac), o = i.value, s = i.max, c = a.value;
		if (!C(o) || !C(s) || !C(c)) return null;
		let l = x(n.saves), u = x(x(n.resources).heroPoints), d = x(n.traits);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: ee(e, t),
			hp: {
				current: o,
				max: s,
				temp: w(i.temp)
			},
			defenses: {
				ac: c,
				fort: w(x(l.fortitude).value),
				reflex: w(x(l.reflex).value),
				will: w(x(l.will).value)
			},
			deathState: {
				dying: g(t, "dying"),
				wounded: g(t, "wounded"),
				doomed: g(t, "doomed"),
				heroPoints: w(u.value)
			},
			traits: E(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return _(t).filter((e) => e.type === "melee").map((e) => {
			let t = x(e.system), n = y(t), r = b(t);
			if (!C(n) || typeof r != "string") return null;
			let i = E(x(t.traits).value);
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
function ee(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === m ? "enemy" : "neutral";
}
function g(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? w(n.value) ?? w(x(x(n.system).value).value) ?? 0 : 0;
}
function _(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(v);
	let n = x(t).contents;
	if (Array.isArray(n)) return n.filter(v);
	if (S(t) && typeof t.filter == "function") {
		let e = t.filter(v);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function v(e) {
	return S(e);
}
function y(e) {
	return T(x(e.bonus).value) ?? T(x(e.attack).value);
}
function b(e) {
	let t = x(e.damageRolls), n = Object.values(t).find(S);
	if (!n) return;
	let r = n.damage, i = n.formula;
	if (typeof r == "string") return r;
	if (typeof i == "string") return i;
}
function x(e) {
	return S(e) ? e : {};
}
function S(e) {
	return typeof e == "object" && !!e;
}
function C(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function w(e) {
	return C(e) ? e : void 0;
}
function T(e) {
	if (C(e)) return e;
	if (typeof e != "string") return;
	let t = Number(e.trim().replace(/^\+/, ""));
	return C(t) ? t : void 0;
}
function E(e) {
	return Array.isArray(e) ? e.map((e) => {
		if (typeof e == "string") return e;
		let t = x(e).slug;
		return typeof t == "string" ? t : null;
	}).filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/engine/degree-of-success.ts
var D = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function O(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? k(i, 1) : t === 1 ? k(i, -1) : i;
}
function k(e, t) {
	let n = D.indexOf(e);
	return D[Math.max(0, Math.min(D.length - 1, n + t))];
}
//#endregion
//#region src/engine/attack-probability.ts
function te(e) {
	let t = {
		criticalSuccess: 0,
		success: 0,
		failure: 0,
		criticalFailure: 0
	};
	for (let n = 1; n <= 20; n += 1) {
		let r = O({
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
function ne(e) {
	let t = re(e).match(/[+-]?[^+-]+/g) ?? [], n = new Map([[0, 1]]);
	for (let e of t) n = A(n, ie(e));
	return j(n, e);
}
function re(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function ie(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = A(o, s);
	return o;
}
function A(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function j(e, t) {
	let n = Array.from(e.entries()).map(([e, t]) => ({
		damage: e,
		probability: t
	})).sort((e, t) => e.damage - t.damage);
	if (n.length === 0 || n.reduce((e, t) => e + t.probability, 0) <= 0) throw Error(`Unsupported damage formula: ${t}`);
	let r = n.reduce((e, t) => e + t.damage * t.probability, 0);
	return {
		min: n[0].damage,
		max: n[n.length - 1].damage,
		mean: r,
		outcomes: n
	};
}
//#endregion
//#region src/engine/mortality.ts
function M(e) {
	let t = ne(e.damageFormula), n = I(t), r = N(e.mapType).slice(0, e.strikes), i = [], a = [], o = 0, s = 0, c = 0, l = new Map([[0, 1]]);
	for (let u of r) {
		let r = te({
			attackBonus: e.attackBonus + u,
			ac: e.ac
		});
		i.push(r.success), a.push(r.criticalSuccess);
		let d = r.failure + r.criticalFailure;
		o += r.success * t.mean + r.criticalSuccess * n.mean, s += r.success * L(t.outcomes, e.hp), c += r.criticalSuccess * L(n.outcomes, e.hp), l = P(l, [
			{
				damage: 0,
				probability: d
			},
			...F(t.outcomes, r.success),
			...F(n.outcomes, r.criticalSuccess)
		]);
	}
	let u = z(R(l, e.hp));
	return {
		downProbability: u,
		expectedHpAfterTurn: Math.max(0, e.hp - o),
		hitChanceByStrike: i,
		critChanceByStrike: a,
		riskLabel: B(u),
		topRiskDrivers: V({
			downProbability: u,
			hitDownProbability: s,
			critDownProbability: c,
			highestCritChance: Math.max(...a)
		}),
		assumptions: [
			"Uses exact damage distributions for supported formulas.",
			"Critical damage is modeled as simple double damage of the supported formula total.",
			`Enemy turn model: ${e.strikes} Strike${e.strikes === 1 ? "" : "s"}.`,
			`MAP model: ${e.mapType}.`
		],
		notModeled: [
			"Resistance, weakness, and immunity.",
			"Deadly, fatal, precision, splash, and persistent damage.",
			"Reactions such as Shield Block or Champion reactions.",
			"Healing before or during the enemy turn.",
			"Permanent death probability."
		],
		damage: H(t, n)
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
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function I(e) {
	return {
		min: e.min * 2,
		max: e.max * 2,
		mean: e.mean * 2,
		outcomes: e.outcomes.map((e) => ({
			damage: e.damage * 2,
			probability: e.probability
		}))
	};
}
function L(e, t) {
	return e.reduce((e, n) => e + (n.damage >= t ? n.probability : 0), 0);
}
function R(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function z(e) {
	return Math.max(0, Math.min(1, e));
}
function B(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function V({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function H(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: U(e, n)
	};
}
function U(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/ui/panel-data.ts
var W = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	attackId: ""
}, G = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function ae({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: G,
		errors: e.errors,
		controls: K(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = J(o, n.attackId), c = q(i, a, s), l = K(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: G,
		errors: c,
		controls: l
	};
	let u = oe(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = M({
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
		permanentDeath: G,
		errors: [],
		controls: l,
		subject: i,
		enemy: a,
		attack: s,
		risk: {
			downPercent: Y(p.downProbability),
			expectedHpAfterTurn: p.expectedHpAfterTurn.toFixed(1),
			riskLabel: p.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: se(i, n.woundedOverride),
			damage: p.damage,
			strikeChances: p.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: Y(e),
				critPercent: Y(p.critChanceByStrike[t] ?? 0)
			})),
			assumptions: m,
			notModeled: p.notModeled
		}
	};
}
function K(e, t, n = e.attackId) {
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
function q(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function J(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function oe(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function se(e, t) {
	return t === "current" ? `Current actor wounded value: ${e.deathState?.wounded ?? 0}` : `Override displayed: Wounded ${t}`;
}
function Y(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/ui/mortality-panel.ts
var X = class extends Application {
	controls = { ...W };
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
		super(e), this.controls.strikes = Z(ce("defaultStrikes", 2));
	}
	async getData() {
		return ae({
			selection: f(),
			adapter: new h(),
			controls: this.controls,
			moduleVersion: r
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = de(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = Z(Number(t))), e === "mapMode" && (this.controls.mapMode = le(t)), e === "shieldBonus" && (this.controls.shieldBonus = ue(t)), e === "woundedOverride" && (this.controls.woundedOverride = Q(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function ce(e, n) {
	let r = game.settings.get(t, e);
	return typeof r == "number" ? r : n;
}
function Z(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function le(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function ue(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function Q(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function de(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/token-controls.ts
var $ = `${t}-open-panel`;
function fe() {
	new X().render(!0);
}
function pe() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[$] = {
			name: $,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: fe
		});
	});
}
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), d(), pe();
}), Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let e = game.modules.get(t);
	e && (e.api = {
		openPanel: () => new X().render(!0),
		captureTokenDebug: (e = canvas.tokens?.controlled?.[0]) => a(e)
	});
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map