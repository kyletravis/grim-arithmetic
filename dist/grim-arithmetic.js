var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.4.2",
	authors: [{ name: "Kyle Travis" }],
	compatibility: {
		minimum: "13",
		verified: "14.361"
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
	download: "https://github.com/kyletravis/grim-arithmetic/releases/download/v0.4.2/grim-arithmetic-v0.4.2.zip"
}, t = "grim-arithmetic", n = "Grim Arithmetic", r = e.version;
//#endregion
//#region src/debug-capture.ts
function i(e) {
	let t = e.actor, n = d(t?.system);
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
			system: o(n),
			itemTypes: l(t.itemTypes),
			meleeItems: u(t.items).filter((e) => e.type === "melee").map((e) => ({
				id: e.id,
				name: e.name,
				type: e.type,
				system: {
					bonus: d(e.system).bonus,
					attack: d(e.system).attack,
					damageRolls: d(e.system).damageRolls,
					traits: d(e.system).traits
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
	let t = c({
		immunities: e.immunities,
		weaknesses: e.weaknesses,
		resistances: e.resistances
	});
	return c({
		attributes: s(e),
		saves: e.saves,
		traits: e.traits,
		legacyDamageAdjustments: Object.keys(t).length > 0 ? t : void 0
	});
}
function s(e) {
	let t = d(e.attributes);
	return c({
		hp: t.hp,
		ac: t.ac,
		immunities: t.immunities,
		weaknesses: t.weaknesses,
		resistances: t.resistances
	});
}
function c(e) {
	return Object.fromEntries(Object.entries(e).filter(([, e]) => e !== void 0));
}
function l(e) {
	return { condition: d(e).condition };
}
function u(e) {
	if (Array.isArray(e)) return e.filter(f);
	let t = d(e).contents;
	if (Array.isArray(t)) return t.filter(f);
	if (f(e) && typeof e.filter == "function") {
		let t = e.filter(f);
		return Array.isArray(t) ? t.filter(f) : [];
	}
	return [];
}
function d(e) {
	return f(e) ? e : {};
}
function f(e) {
	return typeof e == "object" && !!e;
}
//#endregion
//#region src/settings.ts
function p() {
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
function m() {
	return h({
		controlled: canvas.tokens?.controlled,
		targets: game.user?.targets
	});
}
function h(e) {
	let t = e.controlled ?? [], n = Array.from(e.targets ?? []), r = [], i = t.length === 1 ? t[0] : null, a = n.length === 1 ? n[0] : null;
	return t.length === 0 && r.push("No PC token selected. Select one PC token."), t.length > 1 && r.push("Multiple tokens selected. Select only one PC token."), n.length === 0 && r.push("No target selected. Target one enemy token."), n.length > 1 && r.push("Multiple targets selected. Target only one enemy token."), {
		subjectToken: i,
		enemyToken: a,
		errors: r
	};
}
//#endregion
//#region src/foundry/encounter-participants.ts
var g = "Unknown actor", _ = "No active combat encounter — using scene tokens as a best-effort fallback.", ee = "No active combat encounter.";
function te(e, t, n = {}) {
	let r = e.combatants ? Array.from(e.combatants) : [];
	return r.length > 0 ? v(r.map((e) => e.token), t, []) : n.allowSceneFallback && e.sceneTokens ? v(Array.from(e.sceneTokens), t, [_]) : {
		pcs: [],
		hostiles: [],
		unsupported: [],
		caveats: [ee]
	};
}
function v(e, t, n) {
	let r = [], i = [], a = [], o = [...n];
	for (let n of e) {
		if (!n) {
			a.push(`${g} (no token)`);
			continue;
		}
		let e;
		try {
			e = t.getCombatantFromToken(n);
		} catch {
			a.push(n.name ?? g);
			continue;
		}
		if (!e) {
			a.push(n.name ?? g);
			continue;
		}
		e.disposition === "pc" ? r.push({
			token: n,
			snapshot: e
		}) : e.disposition === "enemy" ? i.push({
			token: n,
			snapshot: e
		}) : o.push(`${e.name} is ${e.disposition} and was excluded from the danger board.`);
	}
	return {
		pcs: r,
		hostiles: i,
		unsupported: a,
		caveats: o
	};
}
function ne(e, t = {}) {
	let n = game.combat, r = n?.combatants ? Array.from(n.combatants).map((e) => ({ token: re(e) })) : void 0, i = canvas.tokens?.placeables;
	return te({
		combatants: r,
		sceneTokens: i
	}, e, t);
}
function re(e) {
	let t = e.token;
	if (t) return t.object ?? t;
}
//#endregion
//#region src/engine/degree-of-success.ts
var y = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function ie(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? b(i, 1) : t === 1 ? b(i, -1) : i;
}
function b(e, t) {
	let n = y.indexOf(e);
	return y[Math.max(0, Math.min(y.length - 1, n + t))];
}
//#endregion
//#region src/engine/attack-probability.ts
function ae(e) {
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
function oe(e) {
	let t = se(e).match(/[+-]?[^+-]+/g) ?? [], n = new Map([[0, 1]]);
	for (let e of t) n = x(n, ce(e));
	return le(n, e);
}
function se(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function ce(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = x(o, s);
	return o;
}
function x(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function le(e, t) {
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
function S(e) {
	let t = oe(e.damageFormula), n = _e(t), r = ue(e.damageType, e.targetAdjustments), i = C(t, r), a = C(n, r), o = he(e.mapType).slice(0, e.strikes), s = [], c = [], l = 0, u = 0, d = 0, f = new Map([[0, 1]]);
	for (let t of o) {
		let n = ae({
			attackBonus: e.attackBonus + t,
			ac: e.ac
		});
		s.push(n.success), c.push(n.criticalSuccess);
		let r = n.failure + n.criticalFailure;
		l += n.success * i.mean + n.criticalSuccess * a.mean, u += n.success * O(i.outcomes, e.hp), d += n.criticalSuccess * O(a.outcomes, e.hp), f = ge(f, [
			{
				damage: 0,
				probability: r
			},
			...D(i.outcomes, n.success),
			...D(a.outcomes, n.criticalSuccess)
		]);
	}
	let p = k(ve(f, e.hp)), m = Math.max(0, e.hp - l), h = pe({
		wounded: e.wounded ?? 0,
		doomed: e.doomed ?? 0,
		assumeHeroPointAvailable: e.assumeHeroPointAvailable ?? !1
	});
	return {
		downProbability: p,
		expectedHpAfterTurn: m,
		hitChanceByStrike: s,
		critChanceByStrike: c,
		riskLabel: A(p),
		topRiskDrivers: j({
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
		damage: M(i, a),
		dyingSeverity: h,
		damageAdjustment: r
	};
}
function ue(e, t) {
	let n = E(e), r = {
		damageType: n ?? "unknown",
		resistance: 0,
		weakness: 0,
		immune: !1,
		note: "Damage type unknown; no resistance, weakness, or immunity applied."
	};
	if (!n) return r;
	let i = w(t?.resistances ?? [], n), a = w(t?.weaknesses ?? [], n);
	if ((t?.immunities ?? []).some((e) => T(e, n))) return {
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
		note: o.length > 0 ? `Applied ${de(o)}.` : `No ${n} resistance, weakness, or immunity matched.`
	};
}
function de(e) {
	return e.length <= 1 ? e[0] ?? "" : `${e.slice(0, -1).join(", ")} and ${e.at(-1)}`;
}
function C(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.outcomes) {
		let e = fe(r.damage, t);
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
function fe(e, t) {
	return t.immune ? 0 : Math.max(0, e - t.resistance) + t.weakness;
}
function w(e, t) {
	return e.reduce((e, n) => T(n.type, t) ? Math.max(e, n.value) : e, 0);
}
function T(e, t) {
	let n = E(e), r = E(t);
	return !n || !r ? !1 : n === r || n === "all" ? !0 : n === "physical" ? r === "bludgeoning" || r === "piercing" || r === "slashing" : !1;
}
function E(e) {
	if (e) return e.trim().toLowerCase().replace(/\s+/g, "-");
}
function pe({ wounded: e, doomed: t, assumeHeroPointAvailable: n }) {
	let r = Math.max(0, Math.floor(e)), i = Math.max(0, Math.floor(t)), a = Math.max(1, 4 - i), o = 1 + r, s = 2 + r;
	return {
		wounded: r,
		doomed: i,
		deathThreshold: a,
		normalDownDying: o,
		critDownDying: s,
		immediateDeathFlag: me({
			normalDownDying: o,
			critDownDying: s,
			deathThreshold: a
		}),
		heroPointNote: n ? "Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability." : "No Hero Point death-prevention assumption is applied."
	};
}
function me({ normalDownDying: e, critDownDying: t, deathThreshold: n }) {
	return e >= n ? `Normal down would reach Dying ${e}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t >= n ? `Crit-down would reach Dying ${t}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t === n - 1 ? `Crit-down would put this PC at Dying ${t}, one step below the doomed-adjusted death threshold (Dying ${n}).` : `If downed, severity would be Dying ${e} on a normal hit or Dying ${t} on a critical hit.`;
}
function he(e) {
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
function ge(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function D(e, t) {
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function _e(e) {
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
function O(e, t) {
	return e.reduce((e, n) => e + (n.damage >= t ? n.probability : 0), 0);
}
function ve(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function k(e) {
	return Math.max(0, Math.min(1, e));
}
function A(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function j({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function M(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: N(e, n)
	};
}
function N(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/engine/encounter-risk.ts
var P = (e) => `${e} has no supported melee Strike with numeric attack bonus and damage formula.`, F = "Encounter too large to compute pairwise risk safely. Reduce combatants or use the single-pair detail view.";
function ye(e, t) {
	let { adapter: n, controls: r, pairLimit: i } = t, a = e.hostiles.map((e) => ({
		hostile: e,
		attacks: xe(n, e.token)
	})), o = e.pcs.length * a.reduce((e, t) => e + t.attacks.length, 0);
	if (i !== void 0 && o > i) return {
		pairs: [],
		skipped: !0,
		caveats: [F]
	};
	let s = [], c = [];
	for (let { hostile: t, attacks: n } of a) {
		if (n.length === 0) {
			c.push(P(t.snapshot.name));
			continue;
		}
		for (let i of e.pcs) for (let e of n) s.push(be(i.snapshot, t.snapshot, e, r));
	}
	return {
		pairs: s,
		skipped: !1,
		caveats: c
	};
}
function be(e, t, n, r) {
	let i = [];
	try {
		let a = S({
			hp: e.hp.current + (e.hp.temp ?? 0),
			ac: e.defenses.ac + r.shieldBonus,
			attackBonus: n.attackBonus,
			damageFormula: n.damageFormula,
			strikes: r.strikes,
			mapType: Se(r.mapMode, n.mapType),
			wounded: Ce(e, r.woundedOverride),
			doomed: e.deathState?.doomed ?? 0,
			assumeHeroPointAvailable: we(e, r.heroPointMode),
			damageType: n.damageType,
			targetAdjustments: e.damageAdjustments
		});
		return {
			pcId: e.id,
			pcName: e.name,
			enemyId: t.id,
			enemyName: t.name,
			attackId: n.id,
			attackName: n.name,
			downProbability: a.downProbability,
			riskLabel: a.riskLabel,
			caveats: i
		};
	} catch (r) {
		return i.push(`Risk could not be computed for this pair: ${r instanceof Error ? r.message : "unknown error"}.`), {
			pcId: e.id,
			pcName: e.name,
			enemyId: t.id,
			enemyName: t.name,
			attackId: n.id,
			attackName: n.name,
			downProbability: 0,
			riskLabel: "Low",
			caveats: i
		};
	}
}
function xe(e, t) {
	try {
		return e.getAttacksFromToken(t);
	} catch {
		return [];
	}
}
function Se(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function Ce(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function we(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
//#endregion
//#region src/systems/pf2e-adapter.ts
var Te = -1, Ee = class {
	id = "pf2e";
	label = "Pathfinder Second Edition";
	getCombatantFromToken(e) {
		let t = e.actor;
		if (!t) return null;
		let n = z(t.system), r = z(n.attributes), i = z(r.hp), a = z(r.ac), o = i.value, s = i.max, c = a.value;
		if (!V(o) || !V(s) || !V(c)) return null;
		let l = z(n.saves), u = z(z(n.resources).heroPoints), d = z(n.traits);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: De(e, t),
			hp: {
				current: o,
				max: s,
				temp: H(i.temp)
			},
			defenses: {
				ac: c,
				fort: H(z(l.fortitude).value),
				reflex: H(z(l.reflex).value),
				will: H(z(l.will).value)
			},
			deathState: {
				dying: I(t, "dying"),
				wounded: I(t, "wounded"),
				doomed: I(t, "doomed"),
				heroPoints: H(u.value)
			},
			damageAdjustments: {
				resistances: R(r.resistances ?? n.resistances),
				weaknesses: R(r.weaknesses ?? n.weaknesses),
				immunities: Ne(r.immunities ?? n.immunities)
			},
			traits: W(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return Oe(t).filter((e) => e.type === "melee").map((e) => {
			let t = z(e.system), n = ke(t), r = Ae(t), i = je(r);
			if (!V(n) || typeof i != "string") return null;
			let a = W(z(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: i,
				damageType: Me(r),
				traits: a,
				mapType: a.includes("agile") ? "agile" : "normal",
				assumptions: ["PF2e Strike extraction is first-pass and may miss conditional modifiers."]
			};
		}).filter((e) => e !== null);
	}
};
function De(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === Te ? "enemy" : "neutral";
}
function I(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? H(n.value) ?? H(z(z(n.system).value).value) ?? 0 : 0;
}
function Oe(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(L);
	let n = z(t).contents;
	if (Array.isArray(n)) return n.filter(L);
	if (B(t) && typeof t.filter == "function") {
		let e = t.filter(L);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function L(e) {
	return B(e);
}
function ke(e) {
	return U(z(e.bonus).value) ?? U(z(e.attack).value);
}
function Ae(e) {
	let t = z(e.damageRolls);
	return Object.values(t).find(B);
}
function je(e) {
	if (!e) return;
	let t = e.damage, n = e.formula;
	if (typeof t == "string") return t;
	if (typeof n == "string") return n;
}
function Me(e) {
	if (!e) return;
	let t = e.damageType ?? e.type ?? e.category;
	return typeof t == "string" ? t : void 0;
}
function R(e) {
	return (Array.isArray(e) ? e : Object.values(z(e))).filter(B).map((e) => {
		let t = e.type ?? e.slug ?? e.label, n = U(e.value) ?? U(e.amount);
		return typeof t != "string" || n === void 0 ? null : {
			type: t,
			value: n
		};
	}).filter((e) => e !== null);
}
function Ne(e) {
	return (Array.isArray(e) ? e : Object.values(z(e))).map((e) => {
		if (typeof e == "string") return e;
		let t = z(e), n = t.type ?? t.slug ?? t.label;
		return typeof n == "string" ? n : null;
	}).filter((e) => typeof e == "string");
}
function z(e) {
	return B(e) ? e : {};
}
function B(e) {
	return typeof e == "object" && !!e;
}
function V(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function H(e) {
	return V(e) ? e : void 0;
}
function U(e) {
	if (V(e)) return e;
	if (typeof e != "string") return;
	let t = Number(e.trim().replace(/^\+/, ""));
	return V(t) ? t : void 0;
}
function W(e) {
	return Array.isArray(e) ? e.map((e) => {
		if (typeof e == "string") return e;
		let t = z(e).slug;
		return typeof t == "string" ? t : null;
	}).filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/ui/danger-board.ts
var Pe = 5;
function Fe(e, t = {}) {
	let n = t.topN ?? Pe;
	return {
		topEndangeredPcs: G(e.pairs, (e) => e.pcId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(K),
		topDangerousEnemies: G(e.pairs, (e) => e.enemyId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(K),
		caveats: e.caveats,
		empty: e.pairs.length === 0,
		skipped: e.skipped
	};
}
function G(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = t(r), i = n.get(e);
		(!i || r.downProbability > i.downProbability) && n.set(e, r);
	}
	return Array.from(n.values());
}
function K(e) {
	let t = Math.round(e.downProbability * 100);
	return {
		pcName: e.pcName,
		enemyName: e.enemyName,
		attackName: e.attackName,
		downPercent: t,
		riskLabel: e.riskLabel,
		label: `${e.pcName} vs ${e.enemyName} ${e.attackName} — ${t}% ${e.riskLabel}`
	};
}
//#endregion
//#region src/ui/panel-data.ts
var Ie = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	heroPointMode: "actor",
	attackId: ""
}, q = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function Le({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: q,
		errors: e.errors,
		controls: J(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = ze(o, n.attackId), c = Re(i, a, s), l = J(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: q,
		errors: c,
		controls: l
	};
	let u = Be(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = He(i, n.woundedOverride), m = i.deathState?.doomed ?? 0, h = Ue(i, n.heroPointMode), g = S({
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
			downPercent: Y(g.downProbability),
			expectedHpAfterTurn: g.expectedHpAfterTurn.toFixed(1),
			riskLabel: g.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: Ve(i, n.woundedOverride),
			damage: g.damage,
			damageAdjustment: g.damageAdjustment,
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
function Re(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function ze(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function Be(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function Ve(e, t) {
	return t === "current" ? `Current actor wounded value used for dying severity: ${e.deathState?.wounded ?? 0}` : `Override used for dying severity: Wounded ${t}`;
}
function He(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function Ue(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
function Y(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/ui/mortality-panel.ts
var X = class extends Application {
	controls = { ...Ie };
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
		super(e), this.controls.strikes = Q(Z("defaultStrikes", 2));
	}
	async getData() {
		let e = new Ee(), t = Le({
			selection: m(),
			adapter: e,
			controls: this.controls,
			moduleVersion: r
		}), n = Fe(ye(ne(e), {
			adapter: e,
			controls: this.controls
		}));
		return {
			...t,
			dangerBoard: n
		};
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = Je(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = Q(Number(t))), e === "mapMode" && (this.controls.mapMode = We(t)), e === "shieldBonus" && (this.controls.shieldBonus = Ge(t)), e === "woundedOverride" && (this.controls.woundedOverride = Ke(t)), e === "heroPointMode" && (this.controls.heroPointMode = qe(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function Z(e, n) {
	let r = game.settings.get(t, e);
	return typeof r == "number" ? r : n;
}
function Q(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function We(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function Ge(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function Ke(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function qe(e) {
	return e === "available" || e === "unavailable" ? e : "actor";
}
function Je(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "heroPointMode" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/token-controls.ts
var $ = `${t}-open-panel`;
function Ye() {
	new X().render(!0);
}
function Xe() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[$] = {
			name: $,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: Ye
		});
	});
}
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), p(), Xe();
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