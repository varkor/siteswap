# siteswap
*siteswap* is a JavaScript library for parsing, validating, analysing and manipulating siteswaps, a succinct notation for juggling patterns.

## Example
```javascript
const readline = require("readline");
const { Siteswap } = require("siteswap");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.question("Enter a siteswap: ", (input) => {
	try {
		const siteswap = new Siteswap(input);
		if (siteswap.valid) {
			console.log(`${siteswap.pattern} is a period-${siteswap.period} pattern, juggled with ${siteswap.cardinality} prop${siteswap.cardinality !== 1 ? "s" : ""}.`);
		} else {
			console.log(`${input} is an invalid siteswap!`);
		}
	} catch (error) {
		// Catch any syntax errors and handle them differently to simply invalid siteswaps.
		console.log(`"${input}" is not a siteswap!`);
	}
	rl.close();
});
```

## Motivation
The aim for this project was to create an open-source library for siteswap validation that handled the entire range of siteswaps. Many siteswap validators stumble when it comes to the more esoteric notation like `!`, which is really only useful for asynchronous-to-synchronous transitions. Additionally, after having formulated a method for validating theoretical siteswaps – with both throws, and quantities, of negative values – an easy way to allow anyone to experiment with them seemed a nice opportunity. So many people write their own siteswap parsers because there aren't any that meet their needs already that it seemed that someone should sit down and write a complete one for once.

## Installation
Installation is easy. First, install via npm, and check everything is working:
```bash
npm install siteswap
npm test
```
You can try it out using `examples/prompt.js`:
```bash
node examples/prompt.js
```
To use it as a library, simply include it in your project:
```javascript
const { Siteswap } = require("siteswap");
```

## Usage
```javascript
new Siteswap(pattern, [options])
```
### Options
Property | Possible values | Default | Description
--- | --- | --- | ---
`allowTheoreticalPatterns` | `true` or `false` | `false` | Validates theoretical siteswaps, including those with negative throw values, and negative action quantities (allowing for negative-period patterns).
`maximumLength` | Integer | `100` | Limits the state-range of the siteswap (the maximum range of the minimum occupied beat to the maximum occupied beat at any state). Validation time is proportional to the state-range, so it can be useful to cap this when performance matters.

## `Siteswap` Reference
Each `Siteswap` instance contains a collection of the following properties.

Property | Possible values | Present | Description
--- | --- | --- | ---
`valid` | `true` or `false` | Always | Whether the siteswap is a valid siteswap. Theoretical siteswaps are valid only if `allowTheoreticalPatterns: true` has been passed as an option.
`pattern` | String | Always | The pattern passed to the constructor, modulo some reformatting (such as removing whitespace, and converting to lowercase). `"ε"` is used to represent the empty input.
`normalised` | String | If valid | A normalised pattern (see **Terminology**).
`period` | Integer | If valid, or period-0 | The period of the siteswap. Note that all period-0 siteswaps are invalid.
`cardinality` | Integer | If valid | The number of props used in the siteswap.
`ground` | `true` or `false` | If valid | `true` if the siteswap is a ground-state siteswap.
`excited` | `true` or `false` | If valid | `true` if the siteswap is an excited-state siteswap (equivalently: if the siteswap is not a ground-state siteswap).

## Terminology
For the most part, the terminology used in `siteswap` is consistent with standard nomenclature. However, there are some terms it is useful to define, which have not seen widespread use before this point. To clarify some of the terminology used in the source code, it is useful to provide a brief reference:

Term | Meaning
--- | ---
Event | An event is an operation on a single prop (what might be loosely classified as a "throw"). For example, a `7` is an event, and `[64]` contains two events.
Action | An action is a set of events performed on the same beat. For example, `[64]` is an action containing two events.
Chain | A chain of events of actions is that same event or action, repeated a certain number of times. For example, in `7 4^2`, there is a chain of one `7`s followed by a chain of two `4`s.
Normalised | A siteswap is normalised if it satisfies the following four properties: <li> `0` may only occur as a singleton action (i.e. `0` may not occur within a multiplex: `0` is a placeholder symbol) <li> events are ordered from least to greatest within each action (e.g. `[346]`, not `[634]`); <li> any identical adjacent chains of actions or events are combined, summing their quantities (e.g. `b 4^3 4 4^2` is reduced to `b 4^6`); <li> all quantities are non-zero (e.g. `7^0` is disallowed); <li> the siteswap has minimal period (e.g. `744`, not `744744`).
Canonicalised | A siteswap is canonicalised is if it normalised and all quantities are positive (e.g. `7^-1` is disallowed).