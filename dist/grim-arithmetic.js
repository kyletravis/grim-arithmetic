var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.6.0-rc.3",
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
	templates: [
		"templates/pair-detail-panel.hbs",
		"templates/danger-board-panel.hbs",
		"templates/forecast-panel.hbs"
	],
	url: "https://github.com/kyletravis/grim-arithmetic",
	manifest: "https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json",
	download: "https://github.com/kyletravis/grim-arithmetic/releases/download/v0.6.0-rc.3/grim-arithmetic-v0.6.0-rc.3.zip"
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
var p = "enableMonteCarlo";
function m() {
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
	}), game.settings.register(t, p, {
		name: "Enable Monte Carlo encounter simulation",
		hint: "Disable on low-end machines if simulation runs are too slow. The Encounter Danger Board still works either way.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !0
	});
}
function h() {
	if (typeof game > "u") return !0;
	try {
		return !!(game.settings?.get?.("grim-arithmetic", "enableMonteCarlo") ?? !0);
	} catch {
		return !0;
	}
}
//#endregion
//#region src/engine/degree-of-success.ts
var g = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function _(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? v(i, 1) : t === 1 ? v(i, -1) : i;
}
function v(e, t) {
	let n = g.indexOf(e);
	return g[Math.max(0, Math.min(g.length - 1, n + t))];
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
		let r = _({
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
function y(e) {
	let t = te(e).match(/[+-]?[^+-]+/g) ?? [], n = new Map([[0, 1]]);
	for (let e of t) n = b(n, ne(e));
	return re(n, e);
}
function te(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function ne(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = b(o, s);
	return o;
}
function b(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function re(e, t) {
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
function x(e) {
	let t = y(e.damageFormula), n = D(t), r = S(e.damageType, e.targetAdjustments), i = C(t, r), a = C(n, r), o = E(e.mapType).slice(0, e.strikes), s = [], c = [], l = 0, u = 0, d = 0, f = new Map([[0, 1]]);
	for (let t of o) {
		let n = ee({
			attackBonus: e.attackBonus + t,
			ac: e.ac
		});
		s.push(n.success), c.push(n.criticalSuccess);
		let r = n.failure + n.criticalFailure;
		l += n.success * i.mean + n.criticalSuccess * a.mean, u += n.success * O(i.outcomes, e.hp), d += n.criticalSuccess * O(a.outcomes, e.hp), f = le(f, [
			{
				damage: 0,
				probability: r
			},
			...ue(i.outcomes, n.success),
			...ue(a.outcomes, n.criticalSuccess)
		]);
	}
	let p = fe(de(f, e.hp)), m = Math.max(0, e.hp - l), h = se({
		wounded: e.wounded ?? 0,
		doomed: e.doomed ?? 0,
		assumeHeroPointAvailable: e.assumeHeroPointAvailable ?? !1
	});
	return {
		downProbability: p,
		expectedHpAfterTurn: m,
		hitChanceByStrike: s,
		critChanceByStrike: c,
		riskLabel: pe(p),
		topRiskDrivers: me({
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
		damage: he(i, a),
		dyingSeverity: h,
		damageAdjustment: r
	};
}
function S(e, t) {
	let n = T(e), r = {
		damageType: n ?? "unknown",
		resistance: 0,
		weakness: 0,
		immune: !1,
		note: "Damage type unknown; no resistance, weakness, or immunity applied."
	};
	if (!n) return r;
	let i = oe(t?.resistances ?? [], n), a = oe(t?.weaknesses ?? [], n);
	if ((t?.immunities ?? []).some((e) => w(e, n))) return {
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
		note: o.length > 0 ? `Applied ${ie(o)}.` : `No ${n} resistance, weakness, or immunity matched.`
	};
}
function ie(e) {
	return e.length <= 1 ? e[0] ?? "" : `${e.slice(0, -1).join(", ")} and ${e.at(-1)}`;
}
function C(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.outcomes) {
		let e = ae(r.damage, t);
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
function ae(e, t) {
	return t.immune ? 0 : Math.max(0, e - t.resistance) + t.weakness;
}
function oe(e, t) {
	return e.reduce((e, n) => w(n.type, t) ? Math.max(e, n.value) : e, 0);
}
function w(e, t) {
	let n = T(e), r = T(t);
	return !n || !r ? !1 : n === r || n === "all" ? !0 : n === "physical" ? r === "bludgeoning" || r === "piercing" || r === "slashing" : !1;
}
function T(e) {
	if (e) return e.trim().toLowerCase().replace(/\s+/g, "-");
}
function se({ wounded: e, doomed: t, assumeHeroPointAvailable: n }) {
	let r = Math.max(0, Math.floor(e)), i = Math.max(0, Math.floor(t)), a = Math.max(1, 4 - i), o = 1 + r, s = 2 + r;
	return {
		wounded: r,
		doomed: i,
		deathThreshold: a,
		normalDownDying: o,
		critDownDying: s,
		immediateDeathFlag: ce({
			normalDownDying: o,
			critDownDying: s,
			deathThreshold: a
		}),
		heroPointNote: n ? "Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability." : "No Hero Point death-prevention assumption is applied."
	};
}
function ce({ normalDownDying: e, critDownDying: t, deathThreshold: n }) {
	return e >= n ? `Normal down would reach Dying ${e}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t >= n ? `Crit-down would reach Dying ${t}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t === n - 1 ? `Crit-down would put this PC at Dying ${t}, one step below the doomed-adjusted death threshold (Dying ${n}).` : `If downed, severity would be Dying ${e} on a normal hit or Dying ${t} on a critical hit.`;
}
function E(e) {
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
function le(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function ue(e, t) {
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function D(e) {
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
function de(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function fe(e) {
	return Math.max(0, Math.min(1, e));
}
function pe(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function me({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function he(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: ge(e, n)
	};
}
function ge(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/engine/encounter-risk.ts
var _e = (e) => `${e} has no supported melee Strike with numeric attack bonus and damage formula.`, ve = "Encounter too large to compute pairwise risk safely. Reduce combatants or use the single-pair detail view.";
function ye(e, t) {
	let { adapter: n, controls: r, pairLimit: i } = t, a = e.hostiles.map((e) => ({
		hostile: e,
		attacks: xe(n, e.token)
	})), o = e.pcs.length * a.reduce((e, t) => e + t.attacks.length, 0);
	if (i !== void 0 && o > i) return {
		pairs: [],
		skipped: !0,
		caveats: [ve]
	};
	let s = [], c = [];
	for (let { hostile: t, attacks: n } of a) {
		if (n.length === 0) {
			c.push(_e(t.snapshot.name));
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
		let a = x({
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
//#region src/foundry/encounter-participants.ts
var k = "Unknown actor", Te = "No active combat encounter — using scene tokens as a best-effort fallback.", Ee = "No active combat encounter.";
function De(e, t, n = {}) {
	let r = e.combatants ? Array.from(e.combatants) : [];
	return r.length > 0 ? Oe(r.map((e) => e.token), t, []) : n.allowSceneFallback && e.sceneTokens ? Oe(Array.from(e.sceneTokens), t, [Te]) : {
		pcs: [],
		hostiles: [],
		unsupported: [],
		caveats: [Ee]
	};
}
function Oe(e, t, n) {
	let r = [], i = [], a = [], o = [...n];
	for (let n of e) {
		if (!n) {
			a.push(`${k} (no token)`);
			continue;
		}
		let e;
		try {
			e = t.getCombatantFromToken(n);
		} catch {
			a.push(n.name ?? k);
			continue;
		}
		if (!e) {
			a.push(n.name ?? k);
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
function ke(e, t = {}) {
	let n = game.combat, r = n?.combatants ? Array.from(n.combatants).map((e) => ({ token: Ae(e) })) : void 0, i = canvas.tokens?.placeables;
	return De({
		combatants: r,
		sceneTokens: i
	}, e, t);
}
function Ae(e) {
	let t = e.token;
	if (t) return t.object ?? t;
}
//#endregion
//#region src/systems/pf2e-adapter.ts
var je = -1, A = class {
	id = "pf2e";
	label = "Pathfinder Second Edition";
	getCombatantFromToken(e) {
		let t = e.actor;
		if (!t) return null;
		let n = F(t.system), r = F(n.attributes), i = F(r.hp), a = F(r.ac), o = i.value, s = i.max, c = a.value;
		if (!L(o) || !L(s) || !L(c)) return null;
		let l = F(n.saves), u = F(F(n.resources).heroPoints), d = F(n.traits), f = R(F(n.perception).value) ?? R(F(r.perception).value);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: Re(e, t),
			hp: {
				current: o,
				max: s,
				temp: R(i.temp)
			},
			defenses: {
				ac: c,
				fort: R(F(l.fortitude).value),
				reflex: R(F(l.reflex).value),
				will: R(F(l.will).value)
			},
			deathState: {
				dying: j(t, "dying"),
				wounded: j(t, "wounded"),
				doomed: j(t, "doomed"),
				heroPoints: R(u.value)
			},
			damageAdjustments: {
				resistances: P(r.resistances ?? n.resistances),
				weaknesses: P(r.weaknesses ?? n.weaknesses),
				immunities: Ue(r.immunities ?? n.immunities)
			},
			initiativeBonus: f,
			traits: B(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return t ? t.type === "character" ? Me(t) : M(t).filter((e) => e.type === "melee").map((e) => {
			let t = F(e.system), n = ze(t), r = Be(t), i = Ve(r);
			if (!L(n) || typeof i != "string") return null;
			let a = B(F(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: i,
				damageType: He(r),
				traits: a,
				mapType: a.includes("agile") ? "agile" : "normal",
				assumptions: ["PF2e Strike extraction is first-pass and may miss conditional modifiers."]
			};
		}).filter((e) => e !== null) : [];
	}
};
function Me(e) {
	let t = F(e.system).actions, n = (Array.isArray(t) ? t : []).map((e) => Ne(e)).filter((e) => e !== null);
	return n.length > 0 ? n : M(e).filter((e) => e.type === "weapon").filter(Ie).map((e) => Le(e)).filter((e) => e !== null);
}
function Ne(e) {
	if (!I(e)) return null;
	let t = z(e.totalModifier) ?? z(e.attackBonus) ?? z(e.mod) ?? z(F(e.attack).totalModifier);
	if (t === void 0) return null;
	let n = Pe(e);
	if (!n) return null;
	let r = Fe(e), i = B(e.traits), a = F(e.item);
	return {
		id: typeof e.slug == "string" && e.slug || typeof e.id == "string" && e.id || typeof a.id == "string" && a.id || "",
		name: typeof e.label == "string" && e.label || typeof e.name == "string" && e.name || typeof a.name == "string" && a.name || "Unknown Strike",
		attackBonus: t,
		damageFormula: n,
		damageType: r,
		traits: i,
		mapType: i.includes("agile") ? "agile" : "normal",
		assumptions: ["PC Strike extracted from actor.system.actions; conditional modifiers (status, MAP-adjacent feats) may be missing."]
	};
}
function Pe(e) {
	if (typeof e.damageFormula == "string") return e.damageFormula;
	if (typeof e.damage == "string") return e.damage;
	if (I(e.damage)) {
		let t = e.damage;
		if (typeof t.formula == "string") return t.formula;
		if (typeof t.damage == "string") return t.damage;
	}
}
function Fe(e) {
	if (typeof e.damageType == "string") return e.damageType;
	if (I(e.damage)) {
		let t = e.damage;
		if (typeof t.damageType == "string") return t.damageType;
		if (typeof t.type == "string") return t.type;
	}
}
function Ie(e) {
	let t = F(F(e.system).equipped);
	if (t.carryType === "held") return !0;
	let n = z(t.handsHeld);
	return n !== void 0 && n > 0;
}
function Le(e) {
	let t = F(e.system), n = F(t.damage), r = z(n.dice) ?? 1, i = z(n.die) ?? 6, a = z(n.modifier) ?? 0;
	if (r < 1 || i < 2) return null;
	let o = a > 0 ? `${r}d${i}+${a}` : a < 0 ? `${r}d${i}${a}` : `${r}d${i}`, s = typeof n.damageType == "string" ? n.damageType : typeof n.type == "string" ? n.type : void 0, c = z(F(t.bonus).value) ?? 0, l = B(F(t.traits).value);
	return {
		id: e.id ?? "",
		name: e.name ?? "Unknown Weapon",
		attackBonus: c,
		damageFormula: o,
		damageType: s,
		traits: l,
		mapType: l.includes("agile") ? "agile" : "normal",
		assumptions: ["PC Strike fallback from weapon item: attack bonus excludes character proficiency and ability modifiers."]
	};
}
function Re(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === je ? "enemy" : "neutral";
}
function j(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? R(n.value) ?? R(F(F(n.system).value).value) ?? 0 : 0;
}
function M(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(N);
	let n = F(t).contents;
	if (Array.isArray(n)) return n.filter(N);
	if (I(t) && typeof t.filter == "function") {
		let e = t.filter(N);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function N(e) {
	return I(e);
}
function ze(e) {
	return z(F(e.bonus).value) ?? z(F(e.attack).value);
}
function Be(e) {
	let t = F(e.damageRolls);
	return Object.values(t).find(I);
}
function Ve(e) {
	if (!e) return;
	let t = e.damage, n = e.formula;
	if (typeof t == "string") return t;
	if (typeof n == "string") return n;
}
function He(e) {
	if (!e) return;
	let t = e.damageType ?? e.type ?? e.category;
	return typeof t == "string" ? t : void 0;
}
function P(e) {
	return (Array.isArray(e) ? e : Object.values(F(e))).filter(I).map((e) => {
		let t = e.type ?? e.slug ?? e.label, n = z(e.value) ?? z(e.amount);
		return typeof t != "string" || n === void 0 ? null : {
			type: t,
			value: n
		};
	}).filter((e) => e !== null);
}
function Ue(e) {
	return (Array.isArray(e) ? e : Object.values(F(e))).map((e) => {
		if (typeof e == "string") return e;
		let t = F(e), n = t.type ?? t.slug ?? t.label;
		return typeof n == "string" ? n : null;
	}).filter((e) => typeof e == "string");
}
function F(e) {
	return I(e) ? e : {};
}
function I(e) {
	return typeof e == "object" && !!e;
}
function L(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function R(e) {
	return L(e) ? e : void 0;
}
function z(e) {
	if (L(e)) return e;
	if (typeof e != "string") return;
	let t = Number(e.trim().replace(/^\+/, ""));
	return L(t) ? t : void 0;
}
function B(e) {
	return Array.isArray(e) ? e.map((e) => {
		if (typeof e == "string") return e;
		let t = F(e).slug;
		return typeof t == "string" ? t : null;
	}).filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/ui/danger-board.ts
var We = 5;
function Ge(e, t = {}) {
	let n = t.topN ?? We;
	return {
		topEndangeredPcs: V(e.pairs, (e) => e.pcId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(H),
		topDangerousEnemies: V(e.pairs, (e) => e.enemyId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(H),
		caveats: e.caveats,
		empty: e.pairs.length === 0,
		skipped: e.skipped
	};
}
function V(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = t(r), i = n.get(e);
		(!i || r.downProbability > i.downProbability) && n.set(e, r);
	}
	return Array.from(n.values());
}
function H(e) {
	let t = Math.round(e.downProbability * 100);
	return {
		pcId: e.pcId,
		enemyId: e.enemyId,
		attackId: e.attackId,
		pcName: e.pcName,
		enemyName: e.enemyName,
		attackName: e.attackName,
		downPercent: t,
		riskLabel: e.riskLabel,
		riskClass: e.riskLabel.toLowerCase(),
		label: `${e.pcName} vs ${e.enemyName} ${e.attackName} — ${t}% ${e.riskLabel}`
	};
}
//#endregion
//#region src/engine/prng.ts
function Ke(e) {
	let t = typeof e == "string" ? U(e) : W(e), n = () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
	return {
		next: n,
		nextInt: (e, t) => {
			if (!Number.isInteger(e) || !Number.isInteger(t)) throw Error(`nextInt bounds must be integers: got ${e}, ${t}`);
			if (e > t) throw Error(`nextInt: min (${e}) must be <= max (${t})`);
			let r = t - e + 1;
			return e + Math.floor(n() * r);
		}
	};
}
function qe(e, t) {
	return Je(typeof e == "string" ? U(e) : W(e), typeof t == "string" ? U(t) : W(t));
}
function U(e) {
	let t = 1779033703 ^ e.length;
	for (let n = 0; n < e.length; n += 1) t = Math.imul(t ^ e.charCodeAt(n), 3432918353), t = t << 13 | t >>> 19;
	return t = Math.imul(t ^ t >>> 16, 2246822507), t = Math.imul(t ^ t >>> 13, 3266489909), t ^= t >>> 16, t >>> 0;
}
function W(e) {
	if (!Number.isFinite(e)) throw Error(`Numeric seed must be finite: got ${e}`);
	return Math.floor(Math.abs(e)) >>> 0;
}
function Je(e, t) {
	let n = (e ^ Math.imul(t, 2654435761)) >>> 0;
	return n = Math.imul(n ^ n >>> 16, 2246822507), n = Math.imul(n ^ n >>> 13, 3266489909), n ^= n >>> 16, n >>> 0;
}
//#endregion
//#region src/engine/initiative.ts
function Ye(e, t, n = {}) {
	if (n.useFixedOrder) return e.map((e) => ({
		combatantId: e.id,
		side: e.side,
		dieRoll: 0,
		bonus: e.initiativeBonus,
		total: e.initiativeBonus
	}));
	let r = n.pcsWinTies ?? !0, i = e.map((e) => {
		let n = t.nextInt(1, 20);
		return {
			combatantId: e.id,
			side: e.side,
			dieRoll: n,
			bonus: e.initiativeBonus,
			total: n + e.initiativeBonus
		};
	});
	return i.sort((e, t) => t.total === e.total ? e.side === t.side ? e.combatantId < t.combatantId ? -1 : 1 : e.side === "pc" ? r ? -1 : 1 : r ? 1 : -1 : t.total - e.total), i;
}
//#endregion
//#region src/engine/sample-strike.ts
function Xe(e, t) {
	let n = t.nextInt(1, 20), r = _({
		die: n,
		total: n + e.attackBonus + e.mapPenalty,
		dc: e.defenderAc
	}), i = 0;
	if (r === "success" || r === "criticalSuccess") {
		let n = y(e.damageFormula), a = S(e.damageType, e.defenderAdjustments);
		i = Ze(C(r === "criticalSuccess" ? D(n) : n, a), t);
	}
	return {
		attackerId: e.attackerId,
		defenderId: e.defenderId,
		attackId: e.attackId,
		attackName: e.attackName,
		degree: r,
		dieRoll: n,
		damage: i
	};
}
function Ze(e, t) {
	let n = t.next(), r = 0;
	for (let t of e.outcomes) if (r += t.probability, n < r) return t.damage;
	return e.outcomes[e.outcomes.length - 1].damage;
}
//#endregion
//#region src/engine/sim-state.ts
function Qe(e, t) {
	if (e.dead || t.damage <= 0) return {
		combatant: e,
		damageAbsorbed: 0,
		becameDowned: !1,
		becameDead: !1
	};
	let n = e.dying > 0 || e.downed, r = e.downed, i = t.damage, a = e.hp.temp, o = e.hp.current + e.hp.temp;
	if (a > 0) {
		let e = Math.min(a, i);
		a -= e, i -= e;
	}
	let s = Math.max(0, e.hp.current - i), c = {
		...e,
		hp: {
			...e.hp,
			current: s,
			temp: a
		}
	}, l = Math.max(0, o - (s + a));
	if (s > 0) return {
		combatant: c,
		damageAbsorbed: l,
		becameDowned: !1,
		becameDead: !1
	};
	if (e.side === "enemy") return {
		combatant: {
			...c,
			downed: !0,
			dead: !0
		},
		damageAbsorbed: l,
		becameDowned: !r,
		becameDead: !0
	};
	let u = t.degree === "criticalSuccess" ? 2 : 1, d = n ? e.dying + u : u + e.wounded, f = d >= Math.max(1, 4 - e.doomed);
	return {
		combatant: {
			...c,
			dying: d,
			downed: !0,
			dead: f
		},
		damageAbsorbed: l,
		becameDowned: !r,
		becameDead: f
	};
}
//#endregion
//#region src/engine/tactics/shared.ts
function $e(e) {
	return !e.downed && !e.dead;
}
function G(e) {
	return e.filter($e);
}
function et(e) {
	return e.filter((e) => !e.dead);
}
function tt(e) {
	if (e.attacks.length === 0) return;
	let t = e.attacks[0], n = q(t.damageFormula);
	for (let r = 1; r < e.attacks.length; r += 1) {
		let i = e.attacks[r], a = q(i.damageFormula);
		a > n && (n = a, t = i);
	}
	return t;
}
function K(e) {
	return e.attacks[0];
}
function q(e) {
	try {
		return y(e).mean;
	} catch {
		return -Infinity;
	}
}
//#endregion
//#region src/engine/tactics/boss-cinematic.ts
var nt = {
	id: "boss-cinematic",
	description: "Use the highest-damage attack on the toughest standing PC, all strikes on the same target.",
	chooseTurn(e) {
		let t = G(e.pcs);
		if (t.length === 0) return { strikes: [] };
		let n = [...t].sort((e, t) => t.hp.current === e.hp.current ? e.id < t.id ? -1 : 1 : t.hp.current - e.hp.current)[0], r = tt(e.attacker) ?? K(e.attacker);
		if (!r) return { strikes: [] };
		let i = [];
		for (let e = 0; e < 2; e += 1) i.push({
			attackId: r.id,
			targetId: n.id,
			mapIndex: e
		});
		return { strikes: i };
	}
}, rt = {
	id: "focus-fire",
	description: "Concentrate every strike on the standing PC with the lowest current HP.",
	chooseTurn(e) {
		let t = G(e.pcs);
		if (t.length === 0) return { strikes: [] };
		let n = K(e.attacker);
		if (!n) return { strikes: [] };
		let r = [...t].sort((e, t) => e.hp.current === t.hp.current ? e.id < t.id ? -1 : 1 : e.hp.current - t.hp.current)[0], i = [];
		for (let e = 0; e < 2; e += 1) i.push({
			attackId: n.id,
			targetId: r.id,
			mapIndex: e
		});
		return { strikes: i };
	}
}, it = {
	id: "predator",
	description: "Prioritize wounded > low-HP > full-HP PCs; attack downed only if no standing PCs remain.",
	chooseTurn(e) {
		let t = G(e.pcs), n;
		if (n = t.length > 0 ? [...t].sort(at) : et(e.pcs), n.length === 0) return { strikes: [] };
		let r = K(e.attacker);
		if (!r) return { strikes: [] };
		let i = n[0], a = [];
		for (let e = 0; e < 2; e += 1) a.push({
			attackId: r.id,
			targetId: i.id,
			mapIndex: e
		});
		return { strikes: a };
	}
};
function at(e, t) {
	return t.wounded === e.wounded ? e.hp.current === t.hp.current ? e.id < t.id ? -1 : 1 : e.hp.current - t.hp.current : t.wounded - e.wounded;
}
//#endregion
//#region src/engine/tactics/index.ts
var ot = {
	"random-legal": {
		id: "random-legal",
		description: "Pick any legal PC target and any attack, independently per strike.",
		chooseTurn(e, t) {
			let n = G(e.pcs);
			if (n.length === 0 || e.attacker.attacks.length === 0) return { strikes: [] };
			let r = [];
			for (let i = 0; i < 2; i += 1) {
				let a = n[t.nextInt(0, n.length - 1)], o = e.attacker.attacks[t.nextInt(0, e.attacker.attacks.length - 1)];
				r.push({
					attackId: o.id,
					targetId: a.id,
					mapIndex: i
				});
			}
			return { strikes: r };
		}
	},
	"spread-damage": {
		id: "spread-damage",
		description: "Distribute strikes across higher-HP standing PCs; never target downed.",
		chooseTurn(e) {
			let t = G(e.pcs);
			if (t.length === 0) return { strikes: [] };
			let n = K(e.attacker);
			if (!n) return { strikes: [] };
			let r = [...t].sort((e, t) => t.hp.current === e.hp.current ? e.id < t.id ? -1 : 1 : t.hp.current - e.hp.current), i = [];
			for (let e = 0; e < 2; e += 1) {
				let t = r[e % r.length];
				i.push({
					attackId: n.id,
					targetId: t.id,
					mapIndex: e
				});
			}
			return { strikes: i };
		}
	},
	"focus-fire": rt,
	predator: it,
	"boss-cinematic": nt
}, st = {
	id: "random-legal",
	description: "PCs target the most-dangerous standing enemy with their primary Strike, twice per turn.",
	chooseTurn(e) {
		let t = e.enemies.filter((e) => !e.downed && !e.dead);
		if (t.length === 0) return { strikes: [] };
		let n = K(e.attacker);
		if (!n) return { strikes: [] };
		let r = [...t].sort(ct)[0], i = [];
		for (let e = 0; e < 2; e += 1) i.push({
			attackId: n.id,
			targetId: r.id,
			mapIndex: e
		});
		return { strikes: i };
	}
};
function ct(e, t) {
	let n = J(e), r = J(t);
	return n === r ? e.hp.current === t.hp.current ? e.id < t.id ? -1 : 1 : e.hp.current - t.hp.current : r - n;
}
function J(e) {
	let t = 0;
	for (let n of e.attacks) try {
		let e = y(n.damageFormula).mean;
		e > t && (t = e);
	} catch {}
	return t;
}
//#endregion
//#region src/engine/run-iteration.ts
function lt(e, t, n, r = 0, i = {}) {
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
	for (let t of e.pcs) a.set(t.id, Y(t)), o.set(t.id, t.hp.current + t.hp.temp);
	for (let t of e.enemies) a.set(t.id, Y(t)), o.set(t.id, t.hp.current + t.hp.temp);
	let s = Ye(Array.from(a.values()), n, { useFixedOrder: i.useFixedInitiative }), c = ot[t.tacticsProfile], l = st, u = {}, d = [], f = null, p = 0;
	for (let e = 1; e <= t.maxRounds; e += 1) {
		p = e;
		for (let r of s) {
			let i = a.get(r.combatantId);
			if (!i || i.dead || i.downed) continue;
			let o = ut(a, "pc"), s = ut(a, "enemy"), p = (i.side === "pc" ? l : c).chooseTurn({
				attacker: i,
				pcs: o,
				enemies: s,
				round: e
			}, n);
			if (p.strikes.length !== 0) for (let r of p.strikes) {
				let o = a.get(r.targetId), s = i.attacks.find((e) => e.id === r.attackId);
				if (!o || o.dead || !s) continue;
				let c = E(s.mapType === "unknown" ? "normal" : s.mapType)[r.mapIndex] ?? 0, l = Xe({
					attackerId: i.id,
					defenderId: o.id,
					attackId: s.id,
					attackName: s.name,
					attackBonus: s.attackBonus,
					mapPenalty: c,
					defenderAc: o.defenses.ac,
					damageFormula: s.damageFormula,
					damageType: s.damageType,
					defenderAdjustments: o.damageAdjustments
				}, n), p = Qe(o, {
					damage: l.damage,
					degree: l.degree
				});
				if (a.set(o.id, p.combatant), p.damageAbsorbed > 0) {
					let e = `${i.id}->${o.id}`;
					u[e] = (u[e] ?? 0) + p.damageAbsorbed;
				}
				p.becameDowned && o.side === "pc" && f === null && (f = e), t.captureEvents && d.push({
					round: e,
					attackerId: i.id,
					defenderId: o.id,
					attackId: s.id,
					attackName: s.name,
					degree: l.degree,
					damage: p.damageAbsorbed,
					causedDown: p.becameDowned
				});
			}
		}
		if (dt(a) || ft(a)) break;
	}
	let m = Array.from(a.values()).map((e) => ({
		id: e.id,
		side: e.side,
		endingHp: e.hp.current,
		dying: e.dying,
		wounded: e.wounded,
		doomed: e.doomed,
		downed: e.downed,
		dead: e.dead,
		damageTaken: Math.max(0, (o.get(e.id) ?? 0) - (e.hp.current + e.hp.temp))
	})), h = pt(a);
	return {
		iterationIndex: r,
		roundsElapsed: p,
		firstDownRound: f,
		tpk: h,
		perCombatant: m,
		damageByPair: u,
		events: t.captureEvents ? d : void 0
	};
}
function Y(e) {
	return {
		...e,
		hp: { ...e.hp },
		defenses: { ...e.defenses }
	};
}
function ut(e, t) {
	let n = [];
	for (let r of e.values()) r.side === t && n.push(r);
	return n;
}
function dt(e) {
	let t = 0;
	for (let n of e.values()) if (n.side === "pc" && (t += 1, !n.downed && !n.dead)) return !1;
	return t > 0;
}
function ft(e) {
	let t = 0;
	for (let n of e.values()) if (n.side === "enemy" && (t += 1, !n.dead)) return !1;
	return t > 0;
}
function pt(e) {
	return dt(e);
}
//#endregion
//#region src/engine/simulation-types.ts
var mt = 1e4, ht = class extends Error {
	requested;
	cap;
	constructor(e) {
		super(`Iterations ${e} exceeds engine cap ${mt}`), this.name = "MaxIterationsExceededError", this.requested = e, this.cap = mt;
	}
};
function gt(e) {
	if (!Number.isInteger(e.iterations) || e.iterations < 1) throw Error(`iterations must be a positive integer, got ${e.iterations}`);
	if (e.iterations > 1e4) throw new ht(e.iterations);
	if (!Number.isInteger(e.maxRounds) || e.maxRounds < 1) throw Error(`maxRounds must be a positive integer, got ${e.maxRounds}`);
	if (e.wallClockBudgetMs !== void 0 && (!Number.isFinite(e.wallClockBudgetMs) || e.wallClockBudgetMs < 0)) throw Error(`wallClockBudgetMs must be a non-negative finite number, got ${e.wallClockBudgetMs}`);
}
//#endregion
//#region src/engine/run-simulation.ts
function _t(e, t, n = {}) {
	gt(t);
	let r = t.seed ?? Date.now(), i = t.wallClockBudgetMs ?? 0, a = i > 0 ? Date.now() : 0, o = [], s = !1;
	for (let c = 0; c < t.iterations; c += 1) {
		if (n.abortSignal?.aborted) {
			s = !0;
			break;
		}
		if (i > 0 && Date.now() - a > i) {
			s = !0;
			break;
		}
		let l = qe(r, c);
		o.push(lt(e, t, Ke(l), c)), n.onProgress?.(c + 1, t.iterations);
	}
	return vt(e, t, r, o, s);
}
function vt(e, t, n, r, i) {
	let a = r.length;
	if (a === 0) return {
		iterationsRequested: t.iterations,
		iterationsCompleted: 0,
		seed: n,
		tacticsProfile: t.tacticsProfile,
		aborted: i,
		anyPcDownProbability: 0,
		tpkProbability: 0,
		meanFirstDownRound: null,
		medianFirstDownRound: null,
		perPc: e.pcs.map((e) => ({
			id: e.id,
			name: e.name,
			downProbability: 0,
			deathProbability: 0,
			meanEndingHp: e.hp.current,
			topContributingEnemyId: null
		})),
		perEnemy: e.enemies.map((e) => ({
			id: e.id,
			name: e.name,
			damageShare: 0,
			topTargetId: null
		})),
		caveats: [...e.caveats, "No iterations completed."]
	};
	let o = 0, s = 0, c = [], l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
	for (let e of r) {
		let t = !1, n = !0, r = 0;
		for (let i of e.perCombatant) {
			if (i.side !== "pc") continue;
			r += 1, i.downed || i.dead ? (t = !0, l.set(i.id, (l.get(i.id) ?? 0) + 1)) : n = !1, i.dead && u.set(i.id, (u.get(i.id) ?? 0) + 1);
			let e = d.get(i.id) ?? [];
			e.push(i.endingHp), d.set(i.id, e);
		}
		r > 0 && t && (o += 1), r > 0 && n && (s += 1), e.firstDownRound !== null && c.push(e.firstDownRound);
		for (let [t, n] of Object.entries(e.damageByPair)) f.set(t, (f.get(t) ?? 0) + n);
	}
	let p = e.pcs.map((t) => {
		let n = l.get(t.id) ?? 0, r = u.get(t.id) ?? 0, i = d.get(t.id) ?? [], o = i.length > 0 ? i.reduce((e, t) => e + t, 0) / i.length : t.hp.current, s = null, c = 0;
		for (let n of e.enemies) {
			let e = f.get(`${n.id}->${t.id}`) ?? 0;
			e > c && (c = e, s = n.id);
		}
		return {
			id: t.id,
			name: t.name,
			downProbability: n / a,
			deathProbability: r / a,
			meanEndingHp: o,
			topContributingEnemyId: s
		};
	}), m = 0;
	for (let e of f.values()) m += e;
	let h = e.enemies.map((t) => {
		let n = 0, r = null, i = 0;
		for (let a of e.pcs) {
			let e = f.get(`${t.id}->${a.id}`) ?? 0;
			n += e, e > i && (i = e, r = a.id);
		}
		return {
			id: t.id,
			name: t.name,
			damageShare: m > 0 ? n / m : 0,
			topTargetId: r
		};
	});
	return {
		iterationsRequested: t.iterations,
		iterationsCompleted: a,
		seed: n,
		tacticsProfile: t.tacticsProfile,
		aborted: i,
		anyPcDownProbability: o / a,
		tpkProbability: s / a,
		meanFirstDownRound: c.length > 0 ? c.reduce((e, t) => e + t, 0) / c.length : null,
		medianFirstDownRound: c.length > 0 ? yt(c) : null,
		perPc: p,
		perEnemy: h,
		caveats: [...e.caveats]
	};
}
function yt(e) {
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 == 0 ? (t[n - 1] + t[n]) / 2 : t[n];
}
//#endregion
//#region src/engine/run-simulation-in-worker.ts
var bt = class extends Error {
	constructor() {
		super("Monte Carlo encounter simulation is disabled in module settings."), this.name = "MonteCarloDisabledError";
	}
};
function xt(e, t, n = {}) {
	return h() ? typeof Worker > "u" ? St(e, t, n) : Ct(e, t, n) : {
		promise: Promise.reject(new bt()),
		cancel: () => {}
	};
}
function St(e, t, n) {
	let r = { aborted: !1 };
	return {
		promise: Promise.resolve().then(() => _t(e, t, {
			onProgress: n.onProgress,
			abortSignal: r
		})),
		cancel: () => {
			r.aborted = !0;
		}
	};
}
function Ct(e, t, n) {
	let r = new Worker(new URL(
		/* @vite-ignore */
		"" + new URL("assets/simulation.worker-CDbWZZt1.js", import.meta.url).href,
		"" + import.meta.url
	), { type: "module" }), i = !1, a = !1;
	return {
		promise: new Promise((i, o) => {
			let s = (e) => {
				let t = e.data;
				if (!(!t || typeof t != "object")) switch (t.type) {
					case "progress":
						n.onProgress?.(t.completed, t.total);
						break;
					case "result":
						l(() => i(t.result));
						break;
					case "error":
						l(() => o(Error(t.message)));
						break;
				}
			}, c = (e) => {
				l(() => o(Error(e.message || "Worker error")));
			}, l = (e) => {
				if (!a) {
					a = !0, r.removeEventListener("message", s), r.removeEventListener("error", c);
					try {
						e();
					} finally {
						r.terminate();
					}
				}
			};
			r.addEventListener("message", s), r.addEventListener("error", c);
			let u = {
				type: "run",
				setup: e,
				config: t
			};
			r.postMessage(u);
		}),
		cancel: () => {
			i || a || (i = !0, r.postMessage({ type: "abort" }));
		}
	};
}
//#endregion
//#region src/foundry/encounter-setup.ts
function wt(e, t = {}) {
	return Tt(ke(e, { allowSceneFallback: t.allowSceneFallback }), e);
}
function Tt(e, t) {
	let n = [...e.caveats];
	for (let t of e.unsupported) n.push(`Unsupported actor skipped: ${t}`);
	return {
		pcs: e.pcs.map((e) => {
			let r = [];
			try {
				r = t.getAttacksFromToken(e.token);
			} catch {
				n.push(`${e.snapshot.name}: PC attack extraction failed; treated as no supported Strike.`);
			}
			return r.length === 0 && n.push(`${e.snapshot.name} has no supported Strike; will skip its turns in the simulation.`), Et(e.snapshot, "pc", r, n);
		}),
		enemies: e.hostiles.map((e) => {
			let r = [];
			try {
				r = t.getAttacksFromToken(e.token);
			} catch {
				n.push(`${e.snapshot.name}: attack extraction failed; treated as no supported attacks.`);
			}
			return r.length === 0 && n.push(`${e.snapshot.name} has no supported attacks; will skip its turns.`), Et(e.snapshot, "enemy", r, n);
		}),
		caveats: n
	};
}
function Et(e, t, n, r) {
	return e.initiativeBonus === void 0 && r.push(`${e.name}: initiative bonus unknown; defaulting to 0.`), {
		id: e.id,
		name: e.name,
		side: t,
		hp: {
			current: e.hp.current,
			max: e.hp.max,
			temp: e.hp.temp ?? 0
		},
		defenses: {
			ac: e.defenses.ac,
			fort: e.defenses.fort,
			reflex: e.defenses.reflex,
			will: e.defenses.will
		},
		dying: e.deathState?.dying ?? 0,
		wounded: e.deathState?.wounded ?? 0,
		doomed: e.deathState?.doomed ?? 0,
		heroPoints: e.deathState?.heroPoints ?? 0,
		downed: (e.deathState?.dying ?? 0) > 0,
		dead: !1,
		initiativeBonus: e.initiativeBonus ?? 0,
		damageAdjustments: e.damageAdjustments,
		traits: [...e.traits],
		attacks: [...n]
	};
}
//#endregion
//#region src/ui/panel-data.ts
var Dt = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	heroPointMode: "actor",
	attackId: ""
}, X = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function Ot({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: X,
		errors: e.errors,
		controls: kt(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = jt(o, n.attackId), c = At(i, a, s), l = kt(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: X,
		errors: c,
		controls: l
	};
	let u = Mt(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = Pt(i, n.woundedOverride), m = i.deathState?.doomed ?? 0, h = Ft(i, n.heroPointMode), g = x({
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
		permanentDeath: X,
		errors: [],
		controls: l,
		subject: i,
		enemy: a,
		attack: s,
		risk: {
			downPercent: Z(g.downProbability),
			expectedHpAfterTurn: g.expectedHpAfterTurn.toFixed(1),
			riskLabel: g.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: Nt(i, n.woundedOverride),
			damage: g.damage,
			damageAdjustment: g.damageAdjustment,
			dyingSeverity: g.dyingSeverity,
			strikeChances: g.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: Z(e),
				critPercent: Z(g.critChanceByStrike[t] ?? 0)
			})),
			assumptions: _,
			notModeled: g.notModeled
		}
	};
}
function kt(e, t, n = e.attackId) {
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
function At(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function jt(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function Mt(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function Nt(e, t) {
	return t === "current" ? `Current actor wounded value used for dying severity: ${e.deathState?.wounded ?? 0}` : `Override used for dying severity: Wounded ${t}`;
}
function Pt(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function Ft(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
function Z(e) {
	return Math.round(e * 100);
}
var It = {
	iterations: 5e3,
	tacticsProfile: "focus-fire",
	seed: ""
}, Q = {
	"random-legal": "Random legal",
	"spread-damage": "Spread damage",
	"focus-fire": "Focus fire",
	predator: "Predator",
	"boss-cinematic": "Boss cinematic"
}, Lt = {
	"random-legal": "Enemies pick any legal PC target and any attack independently per strike.",
	"spread-damage": "Enemies spread strikes across higher-HP standing PCs; never target downed.",
	"focus-fire": "Enemies concentrate every strike on the lowest-HP standing PC.",
	predator: "Enemies prioritize wounded > low-HP > full-HP PCs; attack downed only as a last resort.",
	"boss-cinematic": "Enemy uses the highest-damage attack on the toughest standing PC, all strikes on the same target."
}, Rt = [
	1e3,
	5e3,
	1e4
];
function zt({ moduleVersion: e, enabled: t, controls: n, state: r }) {
	let i = [
		"PCs use their primary Strike twice per turn against the most-dangerous standing enemy.",
		"No healing, reactions, recovery checks, or spells are modeled.",
		`Enemy tactics profile: ${Q[n.tacticsProfile]} — ${Lt[n.tacticsProfile]}`,
		`Iterations: ${n.iterations}.`
	];
	if (!t) return {
		moduleVersion: e,
		enabled: !1,
		disabledMessage: "Monte Carlo simulation is disabled in Grim Arithmetic module settings. Enable it in Configure Settings to run forecasts on this client.",
		message: "",
		state: "idle",
		controls: Vt(n),
		assumptions: i
	};
	let a = Vt(n);
	if (r.kind === "idle") return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: "Configure the run and click Run forecast to simulate the active encounter under the selected tactics profile.",
		state: "idle",
		controls: a,
		assumptions: i
	};
	if (r.kind === "running") return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: "Simulation in progress…",
		state: "running",
		controls: a,
		progress: {
			completed: r.completed,
			total: r.total,
			percent: r.total > 0 ? Math.round(r.completed / r.total * 100) : 0
		},
		assumptions: i
	};
	if (r.kind === "error") return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: "Forecast failed.",
		state: "error",
		controls: a,
		errorMessage: r.message,
		assumptions: i
	};
	let o = r.result;
	return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: o.aborted ? `Forecast aborted after ${o.iterationsCompleted} of ${o.iterationsRequested} iterations.` : `Forecast complete (${o.iterationsCompleted} iterations).`,
		state: "done",
		controls: a,
		result: Ht(o),
		pessimismWarning: Bt(o),
		assumptions: [...i, ...o.caveats.map((e) => `Setup: ${e}`)]
	};
}
function Bt(e) {
	if (!(e.anyPcDownProbability < .8)) return "High-risk encounter. Even with PCs taking 2 Strikes per turn against the most-dangerous standing enemy, the modeled outcome ends badly in most iterations. Healing, reactions, and tactical positioning are still not modeled, so real-table risk is usually lower — but this encounter has structural lethality worth examining.";
}
function Vt(e) {
	return {
		iterations: Rt.map((t) => ({
			value: String(t),
			label: `${t.toLocaleString()} iterations`,
			selected: e.iterations === t
		})),
		tacticsProfile: Object.keys(Q).map((t) => ({
			value: t,
			label: Q[t],
			selected: e.tacticsProfile === t
		})),
		seed: e.seed
	};
}
function Ht(e) {
	let t = new Map(e.perPc.map((e) => [e.id, e.name])), n = new Map(e.perEnemy.map((e) => [e.id, e.name]));
	return {
		iterationsCompleted: e.iterationsCompleted,
		iterationsRequested: e.iterationsRequested,
		seed: String(e.seed),
		tacticsProfileLabel: Q[e.tacticsProfile],
		aborted: e.aborted,
		anyPcDownPercent: Math.round(e.anyPcDownProbability * 100),
		tpkPercent: Math.round(e.tpkProbability * 100),
		meanFirstDownRound: e.meanFirstDownRound === null ? "n/a" : e.meanFirstDownRound.toFixed(1),
		medianFirstDownRound: e.medianFirstDownRound === null ? "n/a" : String(e.medianFirstDownRound),
		perPc: e.perPc.map((e) => ({
			id: e.id,
			name: e.name,
			downPercent: Math.round(e.downProbability * 100),
			deathPercent: Math.round(e.deathProbability * 100),
			meanEndingHp: e.meanEndingHp.toFixed(1),
			topContributingEnemyName: e.topContributingEnemyId ? n.get(e.topContributingEnemyId) ?? e.topContributingEnemyId : "—",
			riskClass: Wt(e.downProbability),
			riskLabel: Ut(e.downProbability)
		})),
		perEnemy: e.perEnemy.map((e) => ({
			id: e.id,
			name: e.name,
			damageSharePercent: Math.round(e.damageShare * 100),
			topTargetName: e.topTargetId ? t.get(e.topTargetId) ?? e.topTargetId : "—"
		})),
		caveats: e.caveats
	};
}
function Ut(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function Wt(e) {
	return Ut(e).toLowerCase();
}
//#endregion
//#region src/ui/forecast-panel.ts
var Gt = class e extends Application {
	static instance;
	controls = { ...It };
	runState = { kind: "idle" };
	currentHandle;
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-forecast`,
			title: `${n} — Encounter Forecast`,
			template: `modules/${t}/templates/forecast-panel.hbs`,
			width: 800,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	static getInstance() {
		return e.instance ||= new e(), e.instance;
	}
	static open() {
		e.getInstance().render(!0);
	}
	async getData() {
		return zt({
			moduleVersion: r,
			enabled: h(),
			controls: this.controls,
			state: this.runState
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-forecast-control]").on("change", (e) => {
			let t = e.currentTarget, n = t.dataset?.grimForecastControl;
			if (n === "iterations") {
				let e = Number(t.value);
				(e === 1e3 || e === 5e3 || e === 1e4) && (this.controls.iterations = e);
			} else n === "tacticsProfile" ? (t.value === "random-legal" || t.value === "spread-damage" || t.value === "focus-fire" || t.value === "predator" || t.value === "boss-cinematic") && (this.controls.tacticsProfile = t.value) : n === "seed" && (this.controls.seed = t.value);
			this.render(!1);
		}), e.find("[data-grim-forecast-run]").on("click", () => {
			this.startRun();
		}), e.find("[data-grim-forecast-cancel]").on("click", () => {
			this.currentHandle?.cancel();
		});
	}
	async close(e) {
		return this.currentHandle?.cancel(), super.close(e);
	}
	startRun() {
		let e = new A(), t;
		try {
			t = wt(e);
		} catch (e) {
			this.runState = {
				kind: "error",
				message: e instanceof Error ? e.message : String(e)
			}, this.render(!1);
			return;
		}
		if (t.pcs.length === 0 || t.enemies.length === 0) {
			this.runState = {
				kind: "error",
				message: "No active combat with both PCs and enemies. Start a combat encounter, then run the forecast."
			}, this.render(!1);
			return;
		}
		let n = {
			iterations: this.controls.iterations,
			tacticsProfile: this.controls.tacticsProfile,
			maxRounds: 5,
			seed: this.controls.seed.trim() === "" ? void 0 : this.controls.seed.trim()
		};
		this.runState = {
			kind: "running",
			completed: 0,
			total: this.controls.iterations
		}, this.render(!1);
		let r = xt(t, n, { onProgress: (e, t) => {
			this.runState.kind === "running" && (this.runState = {
				kind: "running",
				completed: e,
				total: t
			}, this.render(!1));
		} });
		this.currentHandle = r, r.promise.then((e) => {
			this.runState = {
				kind: "done",
				result: e
			}, this.currentHandle = void 0, this.render(!1);
		}, (e) => {
			this.runState = {
				kind: "error",
				message: e instanceof Error ? e.message : String(e)
			}, this.currentHandle = void 0, this.render(!1);
		});
	}
};
//#endregion
//#region src/foundry/selection.ts
function Kt() {
	return qt({
		controlled: canvas.tokens?.controlled,
		targets: game.user?.targets
	});
}
function qt(e) {
	let t = e.controlled ?? [], n = Array.from(e.targets ?? []), r = [], i = t.length === 1 ? t[0] : null, a = n.length === 1 ? n[0] : null;
	return t.length === 0 && r.push("No PC token selected. Select one PC token."), t.length > 1 && r.push("Multiple tokens selected. Select only one PC token."), n.length === 0 && r.push("No target selected. Target one enemy token."), n.length > 1 && r.push("Multiple targets selected. Target only one enemy token."), {
		subjectToken: i,
		enemyToken: a,
		errors: r
	};
}
//#endregion
//#region src/ui/pair-detail-resolver.ts
function Jt(e, t) {
	let n = [];
	return e || n.push("PC token is no longer on the canvas. The encounter may have changed since the danger board was rendered."), t || n.push("Enemy token is no longer on the canvas. The encounter may have changed since the danger board was rendered."), {
		subjectToken: e,
		enemyToken: t,
		errors: n
	};
}
//#endregion
//#region src/ui/pair-detail-panel.ts
var $ = class e extends Application {
	static instance;
	controls = { ...Dt };
	explicitSelection;
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-pair-detail`,
			title: `${n} — Pair Detail`,
			template: `modules/${t}/templates/pair-detail-panel.hbs`,
			width: 500,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	static getInstance() {
		return e.instance ||= new e(), e.instance;
	}
	static openForPair(t, n, r) {
		let i = canvas.tokens?.get(t) ?? null, a = canvas.tokens?.get(n) ?? null, o = e.getInstance();
		o.explicitSelection = Jt(i, a), r !== void 0 && (o.controls.attackId = r), o.render(!0);
	}
	static openForSelection() {
		let t = e.getInstance();
		t.explicitSelection = void 0, t.render(!0);
	}
	async getData() {
		return Ot({
			selection: this.explicitSelection ?? Kt(),
			adapter: new A(),
			controls: this.controls,
			moduleVersion: r
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = en(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = Yt(Number(t))), e === "mapMode" && (this.controls.mapMode = Xt(t)), e === "shieldBonus" && (this.controls.shieldBonus = Zt(t)), e === "woundedOverride" && (this.controls.woundedOverride = Qt(t)), e === "heroPointMode" && (this.controls.heroPointMode = $t(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function Yt(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function Xt(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function Zt(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function Qt(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function $t(e) {
	return e === "available" || e === "unavailable" ? e : "actor";
}
function en(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "heroPointMode" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/danger-board-panel.ts
var tn = "Encounter-wide immediate risk. Click a row to see the detail math, or use the selection-target button to model an arbitrary pair.", nn = class extends Application {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-danger-board`,
			title: `${n} — Encounter Danger Board`,
			template: `modules/${t}/templates/danger-board-panel.hbs`,
			width: 640,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	async getData() {
		let e = new A();
		return {
			moduleVersion: r,
			message: tn,
			dangerBoard: Ge(ye(ke(e), {
				adapter: e,
				controls: Dt,
				pairLimit: 200
			})),
			forecastEnabled: h()
		};
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-open-detail-pair]").on("click", (e) => {
			let t = e.currentTarget.dataset, n = t?.grimPcId, r = t?.grimEnemyId, i = t?.grimAttackId;
			!n || !r || $.openForPair(n, r, i);
		}), e.find("[data-grim-open-detail-selection]").on("click", () => {
			$.openForSelection();
		}), e.find("[data-grim-open-forecast]").on("click", () => {
			Gt.open();
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
}, rn = `${t}-open-panel`;
function an() {
	new nn().render(!0);
}
function on() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[rn] = {
			name: rn,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: an
		});
	});
}
//#endregion
//#region src/main.ts
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), m(), on(), sn();
});
function sn() {
	let e = globalThis.Handlebars;
	e && e.registerHelper("eq", function(e, t) {
		return e === t;
	});
}
Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let e = game.modules.get(t);
	e && (e.api = {
		openPanel: () => new nn().render(!0),
		openPairDetail: (e, t, n) => $.openForPair(e, t, n),
		openPairDetailFromSelection: () => $.openForSelection(),
		openForecast: () => Gt.open(),
		captureTokenDebug: (e = canvas.tokens?.controlled?.[0]) => a(e)
	});
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map