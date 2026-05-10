var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.3.0",
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
			disposition: g(e, t),
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
				dying: _(t, "dying"),
				wounded: _(t, "wounded"),
				doomed: _(t, "doomed"),
				heroPoints: w(u.value)
			},
			traits: E(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return v(t).filter((e) => e.type === "melee").map((e) => {
			let t = x(e.system), n = b(t), r = ee(t);
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
function g(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === m ? "enemy" : "neutral";
}
function _(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? w(n.value) ?? w(x(x(n.system).value).value) ?? 0 : 0;
}
function v(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(y);
	let n = x(t).contents;
	if (Array.isArray(n)) return n.filter(y);
	if (S(t) && typeof t.filter == "function") {
		let e = t.filter(y);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function y(e) {
	return S(e);
}
function b(e) {
	return T(x(e.bonus).value) ?? T(x(e.attack).value);
}
function ee(e) {
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
function A(e) {
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
function te(e) {
	let t = ne(e).match(/[+-]?[^+-]+/g) ?? [], n = new Map([[0, 1]]);
	for (let e of t) n = j(n, re(e));
	return ie(n, e);
}
function ne(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function re(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = j(o, s);
	return o;
}
function j(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function ie(e, t) {
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
	let t = te(e.damageFormula), n = R(t), r = F(e.mapType).slice(0, e.strikes), i = [], a = [], o = 0, s = 0, c = 0, l = new Map([[0, 1]]);
	for (let u of r) {
		let r = A({
			attackBonus: e.attackBonus + u,
			ac: e.ac
		});
		i.push(r.success), a.push(r.criticalSuccess);
		let d = r.failure + r.criticalFailure;
		o += r.success * t.mean + r.criticalSuccess * n.mean, s += r.success * z(t.outcomes, e.hp), c += r.criticalSuccess * z(n.outcomes, e.hp), l = I(l, [
			{
				damage: 0,
				probability: d
			},
			...L(t.outcomes, r.success),
			...L(n.outcomes, r.criticalSuccess)
		]);
	}
	let u = V(B(l, e.hp)), d = Math.max(0, e.hp - o), f = N({
		wounded: e.wounded ?? 0,
		doomed: e.doomed ?? 0,
		assumeHeroPointAvailable: e.assumeHeroPointAvailable ?? !1
	});
	return {
		downProbability: u,
		expectedHpAfterTurn: d,
		hitChanceByStrike: i,
		critChanceByStrike: a,
		riskLabel: H(u),
		topRiskDrivers: U({
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
		damage: W(t, n),
		dyingSeverity: f
	};
}
function N({ wounded: e, doomed: t, assumeHeroPointAvailable: n }) {
	let r = Math.max(0, Math.floor(e)), i = Math.max(0, Math.floor(t)), a = Math.max(1, 4 - i), o = 1 + r, s = 2 + r;
	return {
		wounded: r,
		doomed: i,
		deathThreshold: a,
		normalDownDying: o,
		critDownDying: s,
		immediateDeathFlag: P({
			normalDownDying: o,
			critDownDying: s,
			deathThreshold: a
		}),
		heroPointNote: n ? "Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability." : "No Hero Point death-prevention assumption is applied."
	};
}
function P({ normalDownDying: e, critDownDying: t, deathThreshold: n }) {
	return e >= n ? `Normal down would reach Dying ${e}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t >= n ? `Crit-down would reach Dying ${t}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t === n - 1 ? `Crit-down would put this PC at Dying ${t}, one step below the doomed-adjusted death threshold (Dying ${n}).` : `If downed, severity would be Dying ${e} on a normal hit or Dying ${t} on a critical hit.`;
}
function F(e) {
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
function I(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function L(e, t) {
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function R(e) {
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
function z(e, t) {
	return e.reduce((e, n) => e + (n.damage >= t ? n.probability : 0), 0);
}
function B(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function V(e) {
	return Math.max(0, Math.min(1, e));
}
function H(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function U({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function W(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: G(e, n)
	};
}
function G(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/ui/panel-data.ts
var K = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	heroPointMode: "actor",
	attackId: ""
}, q = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function ae({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: q,
		errors: e.errors,
		controls: J(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = se(o, n.attackId), c = oe(i, a, s), l = J(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: q,
		errors: c,
		controls: l
	};
	let u = ce(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = ue(i, n.woundedOverride), m = i.deathState?.doomed ?? 0, h = de(i, n.heroPointMode), g = M({
		hp: f,
		ac: d,
		attackBonus: s.attackBonus,
		damageFormula: s.damageFormula,
		strikes: n.strikes,
		mapType: u,
		wounded: p,
		doomed: m,
		assumeHeroPointAvailable: h
	}), _ = [...s.assumptions, ...g.assumptions];
	return n.shieldBonus > 0 && _.push(`Applies a +${n.shieldBonus} shield/status AC adjustment.`), n.woundedOverride !== "current" && _.push(`Uses wounded override ${n.woundedOverride} for dying severity if the PC is downed.`), n.heroPointMode !== "actor" && _.push(`Uses Hero Point override: ${n.heroPointMode}.`), {
		moduleVersion: r,
		message: "Immediate down-risk estimate based on the selected PC and targeted enemy.",
		permanentDeath: q,
		errors: [],
		controls: l,
		subject: i,
		enemy: a,
		attack: s,
		risk: {
			downPercent: Y(g.downProbability),
			expectedHpAfterTurn: g.expectedHpAfterTurn.toFixed(1),
			riskLabel: g.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: le(i, n.woundedOverride),
			damage: g.damage,
			dyingSeverity: g.dyingSeverity,
			strikeChances: g.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: Y(e),
				critPercent: Y(g.critChanceByStrike[t] ?? 0)
			})),
			assumptions: _,
			notModeled: g.notModeled
		}
	};
}
function J(e, t, n = e.attackId) {
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
		})),
		heroPointMode: [
			["actor", "Use actor Hero Points"],
			["available", "Assume Hero Point available"],
			["unavailable", "Assume no Hero Point"]
		].map(([t, n]) => ({
			value: t,
			label: n,
			selected: e.heroPointMode === t
		}))
	};
}
function oe(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function se(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function ce(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function le(e, t) {
	return t === "current" ? `Current actor wounded value used for dying severity: ${e.deathState?.wounded ?? 0}` : `Override used for dying severity: Wounded ${t}`;
}
function ue(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function de(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
function Y(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/ui/mortality-panel.ts
var X = class extends Application {
	controls = { ...K };
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
		super(e), this.controls.strikes = Z(fe("defaultStrikes", 2));
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
			let t = e.currentTarget, n = ge(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = Z(Number(t))), e === "mapMode" && (this.controls.mapMode = pe(t)), e === "shieldBonus" && (this.controls.shieldBonus = me(t)), e === "woundedOverride" && (this.controls.woundedOverride = Q(t)), e === "heroPointMode" && (this.controls.heroPointMode = he(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function fe(e, n) {
	let r = game.settings.get(t, e);
	return typeof r == "number" ? r : n;
}
function Z(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function pe(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function me(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function Q(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function he(e) {
	return e === "available" || e === "unavailable" ? e : "actor";
}
function ge(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "heroPointMode" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/token-controls.ts
var $ = `${t}-open-panel`;
function _e() {
	new X().render(!0);
}
function ve() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[$] = {
			name: $,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: _e
		});
	});
}
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), d(), ve();
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