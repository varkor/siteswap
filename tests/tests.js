"use strict";
const {Siteswap, SiteswapError} = require("../index.js");

const quiet = process.argv.length >= 3 && ["--quiet", "-q"].includes(process.argv[2]);

// A collection of terminal commands for prettier printing.
const colours = {
	// Commands.
	blink: "\x1b[5m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	hidden: "\x1b[8m",
	reset: "\x1b[0m",
	reverse: "\x1b[7m",
	underscore: "\x1b[4m",
	// Text colours.
	foreground: {
		black: "\x1b[30m",
		blue: "\x1b[34m",
		cyan: "\x1b[36m",
		green: "\x1b[32m",
		magenta: "\x1b[35m",
		red: "\x1b[31m",
		white: "\x1b[37m",
		yellow: "\x1b[33m"
	},
	// Background colours.
	background: {
		black: "\x1b[40m",
		blue: "\x1b[44m",
		cyan: "\x1b[46m",
		green: "\x1b[42m",
		magenta: "\x1b[45m",
		red: "\x1b[41m",
		white: "\x1b[47m",
		yellow: "\x1b[43m"
	}
};

// Test the given pattern to ensure it either validates or invalidates.
function verifySiteswap (pattern, validate = true, properties = {}, settings = void 0) {
	let success;
	// Siteswaps are disallowed if they cause the validator to throw some sort of error. This means the string that was entered was not in a valid format for a siteswap.
	let disallowed = true;
	// Siteswaps are correct if their properties match those given.
	let correct = true;
	let siteswap = null;
	try {
		siteswap = new Siteswap(pattern, settings);
		disallowed = false;
		// Optionally check that it contains all the specified properties and associated values, for stronger proof of correctness.
		for (const [property, value] of Object.entries(Object.assign({ valid: true }, properties))) {
			if (siteswap[property] !== value) {
				correct = property === "valid";
				throw new SiteswapError(`The siteswap ${siteswap.pattern} was expected to have ${property} ${value}, but instead had ${property} ${siteswap[property]}.`);
			}
		}
		success = validate;
	} catch (error) {
		success = !validate;
		if (!(error instanceof SiteswapError)) {
			throw error;
		}
	}
	// Print a message confirming or refuting the success of the test.
	const colour = success ? colours.foreground.green : colours.foreground.red;
	console.log(`${colour}${success ? "✓" : "✗"}\t${colours.dim}[${disallowed ? "Forbidden" : !correct ? "Incorrect" : success === validate ? "  Valid  " : " Invalid "}] ${colours.reset + colour + colours.bright}${pattern}${siteswap !== null ? ` ${colours.reset + colour + colours.dim}${!quiet ? `(${JSON.stringify(siteswap, null, 1).replace(/\n/g, "")})` : ""}` : ""}${colours.reset}`);
	return success;
}

// Check to make sure the pattern is a valid siteswap.
function validateSiteswap (pattern, properties = {}, settings = void 0) {
	return verifySiteswap(pattern, true, properties, settings);
}

// Check to make sure the pattern is invalidated, either because there's a syntax error, or because the siteswap is invalid.
function invalidateSiteswap (pattern, settings = void 0) {
	return verifySiteswap(pattern, false, void 0, settings);
}

// An syntactically invalid pattern.
invalidateSiteswap("-");
// The empty siteswap.
invalidateSiteswap("");
// The 3-ball cascade.
validateSiteswap("3", { period: 1, cardinality: 3, ground: true });
// The 10-ball fountain (shorthand).
validateSiteswap("a", { period: 1, cardinality: 10, ground: true });
// The 10-ball fountain (decimal).
validateSiteswap("{10}", { period: 1, cardinality: 10, ground: true });
// The 10-ball fountain (shorthands should not be permitted inside decimal notation).
invalidateSiteswap("{a}");
// A vanilla siteswap.
validateSiteswap("744", { period: 3, cardinality: 5, ground: true });
// A vanilla siteswap with a length longer than its actual period.
validateSiteswap("333", { period: 1, cardinality: 3, ground: true });
// A ground-state siteswap.
validateSiteswap("531", { period: 3, cardinality: 3, ground: true });
// An excited-state siteswap.
validateSiteswap("91", { period: 2, cardinality: 5, excited: true });
// The 0-ball fountain.
validateSiteswap("0", { period: 1, cardinality: 0, ground: true });
// A multiplex siteswap.
validateSiteswap("[43]23", { period: 3, cardinality: 4, ground: false });
// A negative siteswap (without enabling theoretical siteswaps).
invalidateSiteswap("-5");
// A negative siteswap (enabling theoretical siteswaps).
validateSiteswap("-5", { period: 1, cardinality: -5, ground: true }, { allowTheoreticalPatterns: true });
// A siteswap with an exponentiation.
validateSiteswap("b4^6", { period: 7, cardinality: 5, ground: true });
// A siteswap with a negative cardinality.
validateSiteswap("5^-1", { ground: true }, { allowTheoreticalPatterns: true });
// An invalid period-0 siteswap.
invalidateSiteswap("11^-1", void 0, { allowTheoreticalPatterns: true });
// A siteswap with an absurd length.
invalidateSiteswap("1^{99}20");
// A simple invalid siteswap.
invalidateSiteswap("321");
// A synchronous, 2-handed siteswap.
validateSiteswap("(4,4)", { period: 2, cardinality: 4, ground: false });
// A synchronous, 2-handed siteswap with crossing throws.
validateSiteswap("(4x,4x)", { period: 2, cardinality: 4, ground: false });
// A synchronous siteswap with a suppressed beat.
validateSiteswap("(4,4)!", { period: 1, cardinality: 8, ground: false });
// A synchronous siteswap with two beats of suppression.
validateSiteswap("(4,4,4)!!", { period: 1, cardinality: 12, ground: false });
// A synchronous 0-ball siteswap.
validateSiteswap("(0,0)", { period: 2, cardinality: 0, ground: true });
// A pattern with crossing 0 throws (without enabling theoretical siteswaps).
invalidateSiteswap("(0x,0x)");
// A pattern with crossing 0 throws (enabling theoretical siteswaps).
validateSiteswap("(0x,0x)", { period: 2, cardinality: 0, ground: true }, { allowTheoreticalPatterns: true });
// An explicit 1-handed siteswap.
validateSiteswap("(3)", { period: 1, cardinality: 3, ground: true, hands: 1 });
// The 3-ball cascade, explicitly with 2 hands.
validateSiteswap("(3,0)!(0,3)!", { period: 2, hands: 2, ground: true, hands: 2 });
// An asymmetrical siteswap.
validateSiteswap("(6,4)", { period: 2, cardinality: 5, ground: false, hands: 2 });
// A siteswap with a throw offset that is equal to the number of hands.
invalidateSiteswap("(6xx,4xx)");
// A symmetrical siteswap.
validateSiteswap("(6x,4)(4,6x)", { period: 4, cardinality: 5, ground: false, hands: 2 });
// A siteswap with a starting state that appears like a ground state near the origin.
validateSiteswap("-1[34]", { period: 2, cardinality: 3, ground: false },  { allowTheoreticalPatterns: true });