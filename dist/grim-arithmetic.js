var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.4.0",
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
	templates: ["templates/mortality-panel.hbs"],
	url: "https://github.com/kyletravis/grim-arithmetic",
	manifest: "https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json",
	download: "https://github.com/kyletravis/grim-arithmetic/releases/download/v0.4.0/grim-arithmetic-v0.4.0.zip"
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
			damageAdjustments: {
				resistances: b(n.resistances),
				weaknesses: b(n.weaknesses),
				immunities: x(n.immunities)
			},
			traits: D(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return v(t).filter((e) => e.type === "melee").map((e) => {
			let t = S(e.system), n = ee(t), r = te(t), i = ne(r);
			if (!w(n) || typeof i != "string") return null;
			let a = D(S(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: i,
				damageType: re(r),
				traits: a,
				mapType: a.includes("agile") ? "agile" : "normal",
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
function ee(e) {
	return E(S(e.bonus).value) ?? E(S(e.attack).value);
}
function te(e) {
	let t = S(e.damageRolls);
	return Object.values(t).find(C);
}
function ne(e) {
	if (!e) return;
	let t = e.damage, n = e.formula;
	if (typeof t == "string") return t;
	if (typeof n == "string") return n;
}
function re(e) {
	if (!e) return;
	let t = e.damageType ?? e.type ?? e.category;
	return typeof t == "string" ? t : void 0;
}
function b(e) {
	return (Array.isArray(e) ? e : Object.values(S(e))).filter(C).map((e) => {
		let t = e.type ?? e.slug ?? e.label, n = E(e.value) ?? E(e.amount);
		return typeof t != "string" || n === void 0 ? null : {
			type: t,
			value: n
		};
	}).filter((e) => e !== null);
}
function x(e) {
	return (Array.isArray(e) ? e : Object.values(S(e))).map((e) => {
		if (typeof e == "string") return e;
		let t = S(e), n = t.type ?? t.slug ?? t.label;
		return typeof n == "string" ? n : null;
	}).filter((e) => typeof e == "string");
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
function ie(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? k(i, 1) : t === 1 ? k(i, -1) : i;
}
function k(e, t) {
	let n = O.indexOf(e);
	return O[Math.max(0, Math.min(O.length - 1, n + t))];
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
		let r = ie({
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
function j(e) {
	let t = M(e).match(/[+-]?[^+-]+/g) ?? [], n = new Map([[0, 1]]);
	for (let e of t) n = N(n, ae(e));
	return oe(n, e);
}
function M(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function ae(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = N(o, s);
	return o;
}
function N(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function oe(e, t) {
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
function se(e) {
	let t = j(e.damageFormula), n = G(t), r = ce(e.damageType, e.targetAdjustments), i = F(t, r), a = F(n, r), o = H(e.mapType).slice(0, e.strikes), s = [], c = [], l = 0, u = 0, d = 0, f = new Map([[0, 1]]);
	for (let t of o) {
		let n = A({
			attackBonus: e.attackBonus + t,
			ac: e.ac
		});
		s.push(n.success), c.push(n.criticalSuccess);
		let r = n.failure + n.criticalFailure;
		l += n.success * i.mean + n.criticalSuccess * a.mean, u += n.success * K(i.outcomes, e.hp), d += n.criticalSuccess * K(a.outcomes, e.hp), f = U(f, [
			{
				damage: 0,
				probability: r
			},
			...W(i.outcomes, n.success),
			...W(a.outcomes, n.criticalSuccess)
		]);
	}
	let p = ue(le(f, e.hp)), m = Math.max(0, e.hp - l), h = B({
		wounded: e.wounded ?? 0,
		doomed: e.doomed ?? 0,
		assumeHeroPointAvailable: e.assumeHeroPointAvailable ?? !1
	});
	return {
		downProbability: p,
		expectedHpAfterTurn: m,
		hitChanceByStrike: s,
		critChanceByStrike: c,
		riskLabel: de(p),
		topRiskDrivers: fe({
			downProbability: p,
			hitDownProbability: u,
			critDownProbability: d,
			highestCritChance: Math.max(...c)
		}),
		assumptions: [
			"Uses exact damage distributions for supported formulas.",
			r.note,
			"Critical damage is modeled as simple double damage of the supported formula total.",
			`Enemy turn model: ${e.strikes} Strike${e.strikes === 1 ? "" : "s"}.`,
			`MAP model: ${e.mapType}.`
		],
		notModeled: [
			"Deadly, fatal, precision, splash, and persistent damage.",
			"Reactions such as Shield Block or Champion reactions.",
			"Healing before or during the enemy turn.",
			"Permanent death probability."
		],
		damage: pe(i, a),
		dyingSeverity: h,
		damageAdjustment: r
	};
}
function ce(e, t) {
	let n = z(e), r = {
		damageType: n ?? "unknown",
		resistance: 0,
		weakness: 0,
		immune: !1,
		note: "Damage type unknown; no resistance, weakness, or immunity applied."
	};
	if (!n) return r;
	let i = L(t?.resistances ?? [], n), a = L(t?.weaknesses ?? [], n);
	if ((t?.immunities ?? []).some((e) => R(e, n))) return {
		damageType: n,
		resistance: 0,
		weakness: 0,
		immune: !0,
		note: `Applied ${n} immunity; modeled damage is 0.`
	};
	let o = [];
	return i > 0 && o.push(`${n} resistance ${i}`), a > 0 && o.push(`${n} weakness ${a}`), {
		damageType: n,
		resistance: i,
		weakness: a,
		immune: !1,
		note: o.length > 0 ? `Applied ${P(o)}.` : `No ${n} resistance, weakness, or immunity matched.`
	};
}
function P(e) {
	return e.length <= 1 ? e[0] ?? "" : `${e.slice(0, -1).join(", ")} and ${e.at(-1)}`;
}
function F(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.outcomes) {
		let e = I(r.damage, t);
		n.set(e, (n.get(e) ?? 0) + r.probability);
	}
	let r = Array.from(n.entries()).sort(([e], [t]) => e - t).map(([e, t]) => ({
		damage: e,
		probability: t
	})), i = r.reduce((e, t) => e + t.damage * t.probability, 0);
	return {
		min: r[0]?.damage ?? 0,
		max: r.at(-1)?.damage ?? 0,
		mean: i,
		outcomes: r
	};
}
function I(e, t) {
	return t.immune ? 0 : Math.max(0, e - t.resistance) + t.weakness;
}
function L(e, t) {
	return e.reduce((e, n) => R(n.type, t) ? Math.max(e, n.value) : e, 0);
}
function R(e, t) {
	let n = z(e), r = z(t);
	return !n || !r ? !1 : n === r || n === "all" ? !0 : n === "physical" ? r === "bludgeoning" || r === "piercing" || r === "slashing" : !1;
}
function z(e) {
	if (e) return e.trim().toLowerCase().replace(/\s+/g, "-");
}
function B({ wounded: e, doomed: t, assumeHeroPointAvailable: n }) {
	let r = Math.max(0, Math.floor(e)), i = Math.max(0, Math.floor(t)), a = Math.max(1, 4 - i), o = 1 + r, s = 2 + r;
	return {
		wounded: r,
		doomed: i,
		deathThreshold: a,
		normalDownDying: o,
		critDownDying: s,
		immediateDeathFlag: V({
			normalDownDying: o,
			critDownDying: s,
			deathThreshold: a
		}),
		heroPointNote: n ? "Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability." : "No Hero Point death-prevention assumption is applied."
	};
}
function V({ normalDownDying: e, critDownDying: t, deathThreshold: n }) {
	return e >= n ? `Normal down would reach Dying ${e}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t >= n ? `Crit-down would reach Dying ${t}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t === n - 1 ? `Crit-down would put this PC at Dying ${t}, one step below the doomed-adjusted death threshold (Dying ${n}).` : `If downed, severity would be Dying ${e} on a normal hit or Dying ${t} on a critical hit.`;
}
function H(e) {
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
function U(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function W(e, t) {
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function G(e) {
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
function K(e, t) {
	return e.reduce((e, n) => e + (n.damage >= t ? n.probability : 0), 0);
}
function le(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function ue(e) {
	return Math.max(0, Math.min(1, e));
}
function de(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function fe({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function pe(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: me(e, n)
	};
}
function me(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/ui/panel-data.ts
var he = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	heroPointMode: "actor",
	attackId: ""
}, q = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function ge({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: q,
		errors: e.errors,
		controls: J(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = ve(o, n.attackId), c = _e(i, a, s), l = J(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: q,
		errors: c,
		controls: l
	};
	let u = ye(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = xe(i, n.woundedOverride), m = i.deathState?.doomed ?? 0, h = Y(i, n.heroPointMode), g = se({
		hp: f,
		ac: d,
		attackBonus: s.attackBonus,
		damageFormula: s.damageFormula,
		strikes: n.strikes,
		mapType: u,
		wounded: p,
		doomed: m,
		assumeHeroPointAvailable: h,
		damageType: s.damageType,
		targetAdjustments: i.damageAdjustments
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
			downPercent: X(g.downProbability),
			expectedHpAfterTurn: g.expectedHpAfterTurn.toFixed(1),
			riskLabel: g.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: be(i, n.woundedOverride),
			damage: g.damage,
			damageAdjustment: g.damageAdjustment,
			dyingSeverity: g.dyingSeverity,
			strikeChances: g.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: X(e),
				critPercent: X(g.critChanceByStrike[t] ?? 0)
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
function _e(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function ve(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function ye(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function be(e, t) {
	return t === "current" ? `Current actor wounded value used for dying severity: ${e.deathState?.wounded ?? 0}` : `Override used for dying severity: Wounded ${t}`;
}
function xe(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function Y(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
function X(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/ui/mortality-panel.ts
var Z = class extends Application {
	controls = { ...he };
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
		super(e), this.controls.strikes = Q(Se("defaultStrikes", 2));
	}
	async getData() {
		return ge({
			selection: f(),
			adapter: new h(),
			controls: this.controls,
			moduleVersion: r
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = De(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = Q(Number(t))), e === "mapMode" && (this.controls.mapMode = Ce(t)), e === "shieldBonus" && (this.controls.shieldBonus = we(t)), e === "woundedOverride" && (this.controls.woundedOverride = Te(t)), e === "heroPointMode" && (this.controls.heroPointMode = Ee(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function Se(e, n) {
	let r = game.settings.get(t, e);
	return typeof r == "number" ? r : n;
}
function Q(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function Ce(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function we(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function Te(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function Ee(e) {
	return e === "available" || e === "unavailable" ? e : "actor";
}
function De(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "heroPointMode" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/token-controls.ts
var $ = `${t}-open-panel`;
function Oe() {
	new Z().render(!0);
}
function ke() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[$] = {
			name: $,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: Oe
		});
	});
}
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), d(), ke();
}), Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let e = game.modules.get(t);
	e && (e.api = {
		openPanel: () => new Z().render(!0),
		captureTokenDebug: (e = canvas.tokens?.controlled?.[0]) => a(e)
	});
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map