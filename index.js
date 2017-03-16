"use strict";

class SiteswapError extends Error {
	constructor (message) {
		super(message);
		this.name = "SiteswapError";
	}
}

class Siteswap {
	constructor (pattern, { allowTheoreticalPatterns = false, maximumLength = 100 } = {}) {
		// Whitespace is irrelevant in a siteswap, so we remove it to make subsequent parsing simpler.
		pattern = pattern.replace(/\s/g, "");
		// Siteswap notation is case-insensitive, so we make all letters lowercase to be consistent.
		pattern = pattern.toLowerCase();

		// The empty siteswap, ε, is invalid (as are all period-0 siteswaps).
		if (pattern === "") {
			this.valid = false;
			this.pattern = "ε";
			this.period = 0;
			return;
		}

		// We first test that the siteswap is syntactically valid (actual validity checking will be performed if it passes the syntax checks).
		const syntax = {};
		// Theoretical siteswaps may contain events of negatives values, negative quantities of events, or negative quantities of actions. In each case, this involves potentially prefixing the value or quantity with a unary minus sign (-).
		syntax.sign = `(-?)`;
		// A value can have any nonnegative integer value (\d), or a letter up to "o" (a-o) (letters from "p" onwards may be used for throw modifiers). Alternatively, for more flexibility, a digital value may be used, surrounded with curly brackets ({ and }).
		syntax.value = `(${syntax.sign}[\\da-o]|\\{${syntax.sign}\\d+\\})`;
		// A quantity represents the repetition of some value (such as an event or action), as a useful syntactic shorthand. Quantities are represented by an exponent (\^) sign followed by a value.
		syntax.quantity = `(\\^${syntax.value})`;
		// An event defines the behaviour of a single prop at a single point in time.
		syntax.event = `(${syntax.value})`;
		syntax.events = `(${syntax.event}${syntax.quantity}?)`;
		// An action defines the behaviour of all props whose state is modified at a single point in time (for example, a multiplex). It takes the form of any positive number of events surrounded in square brackets. Alternatively, an event can be used in place of an action to represent the action containing just that event.
		syntax.action = `(${syntax.sign}\\[${syntax.events}+\\]|${syntax.event})`;
		syntax.actions = `(${syntax.action}${syntax.quantity}?)`;
		// A pattern is any sequence of events or actions.
		syntax.pattern = `(${syntax.actions}+)`;

		// We only go on to more thorough validity checks if the input pattern syntactically matches the format of a siteswap.
		// Negative-value events and negative quantities of events and actions are only permitted if `allowTheoreticalPatterns` is enabled.
		if (new RegExp(`^${syntax.pattern}$`).test(pattern) && (allowTheoreticalPatterns || !/-/.test(pattern))) {
			let period = 0;
			let cardinality = 0;

			// The letter "o" is the maximum alphanumeric value permitted, as explained above.
			const base = "o".charCodeAt(0) - ("a".charCodeAt(0) - 1) + 10;
			// `convertValue` converts a value, either in 0 – 9, a – o notation, or in {n} notation, to the equivalent integer.
			function convertValue (string) {
				if (string[0] === "{") {
					return parseInt(string.slice(1, -1));
				}
				return parseInt(string, base);
			}
			// `convertInteger` converts an integer to the equivalent value, as a string.
			function convertInteger (integer) {
				if (integer >= base) {
					return `{${integer}}`;
				}
				if (integer >= 10) {
					return String.fromCharCode("a".charCodeAt(0) - 10 + integer);
				}
				return `${integer}`;
			}

			// `decomposeChain` takes a string of expressions, each of which is either a single element, or an element with a specified quantity using the power (^) operate, and returns { element, quantity } pairs. This is used to parse both actions and events.
			function* decomposeChain (string, expression) {
				const chains = string.match(new RegExp(expression, "g"));
				for (const chain of chains) {
					let element;
					let quantity;
					if (new RegExp(syntax.quantity).test(chain)) {
						element = chain.match(new RegExp(syntax.event, "g"))[0];
						quantity = convertValue(chain.match(new RegExp(syntax.quantity, "g"))[0].match(new RegExp(syntax.value, "g"))[0]);
					} else {
						// Default element and quantity in the case no quantity is present.
						element = chain;
						quantity = 1;
					}
					yield { element, quantity };
				}
			}

			// `actions` holds the chain pairs of actions and events, which will be used for later analysis.
			let actions = [];
			for (const action of decomposeChain(pattern, syntax.actions)) {
				actions.push({ events: [], quantity: action.quantity });
				for (const event of decomposeChain(action.element, syntax.events)) {
					const value = convertValue(event.element);
					actions[actions.length - 1].events.push({ value, quantity: event.quantity });
					cardinality += value * event.quantity * action.quantity;
				}
				period += action.quantity;
			}

			// Period-0 siteswaps are invalid.
			if (period === 0) {
				this.valid = false;
				this.period = 0;
				return;
			}

			// An early invalidity check: valid siteswaps must have an integer cardinality.
			if (cardinality % period !== 0) {
				this.valid = false;
				return;
			}

			// We can be sure, at this stage, that the period and cardinality are valid, even if there are collisions in the pattern. However, we choose to return the minimal period of a pattern, after normalising, so we do not wish to set the period quite yet. For example, we want the period of 333 to be 1, rather than 3.
			this.cardinality = cardinality / period;

			// There are many ways to represent the same siteswap. For example, the multiplexes [34] and [43] are isomorphic (although some distinction might be desirable when the props operated on by the events are not identical), and given any action, X, and quantity Y the chain X^Y can be decomposed into a Y-fold repetition of X (among other decompositions). Although the algorithm below can operate on siteswaps of any form, it is helpful to do some normalisation beforehand to decrease the computational cost of validation. The normal form is simply used for validation. The original pattern is conserved for consistency with the user's expectations.
			// The normal form for a siteswap is defined such that: a) events are ordered from least to greatest within each action; b) any identical adjacent chains of actions or events are combined, and their quantities summed; c) all quantities are non-zero; d) the siteswap has minimal period (for example, 33 is normalised to 3, which is isomorphic).
			// The canonical form for a siteswap has the extra requirement that: d) all quantities are positive. This requires an extra processing step, however, and does not lower the computational cost, so it is not performed for preprocessing.

			// Collapse adjacent chains with equal values and remove chains with quantity 0.
			function reduceSequence(sequence, equal) {
				return sequence.reduce((chains, chain) => {
					// If the current chain is not the same as the previous one, then it forms a new part of the reduced sequence.
					if (chains.length === 0 || !equal(chain, chains[chains.length - 1])) {
						chains.push(chain);
					} else {
						// If the current chain matches the previous one, we can simply add their quantities together.
						chains[chains.length - 1].quantity += chain.quantity;
					}
					return chains;
				}, []).filter((chain) => chain.quantity !== 0); // Empty chains are vacuously useless and can be removed safely.
			}

			// Return an array with the smallest length such that the periodic input sequence can be reduced to it (discarding the number of repetitions).
			function reducePeriod(sequence, equal) {
				// `interval` represents the period of the sequence, named such just to avoid confusion with the period of the siteswap, which is not the same, as interval does not take into account chain quantities.
				let interval = sequence.length;
				// To find the minimal period length, we start with the minimal possible length, and keep checking whether the current slice length is valid. As we're working from smallest to largest, we can return as soon as we find a satisfying slice.
				for (let slice = 1; slice <= sequence.length / 2; ++ slice) {
					// The potential period has to divide the pattern length.
					if (sequence.length % slice !== 0) {
						continue;
					}
					let failure = false;
					// For each pair of subsequences of our slice length, we compare the elements pairwise.
					for (let offset = 0; !failure, offset < sequence.length / slice - 1; ++ offset) {
						for (let index = 0; index < slice; ++ index) {
							// If we find a single mismatch, this slice cannot represent the smallest period.
							if (!equal(sequence[offset * slice + index], sequence[(offset + 1) * slice + index])) {
								failure = true;
								break;
							}
						}
					}
					// If we didn't find a single failure point, then this slice must be a valid representation of the entire pattern.
					if (!failure) {
						interval = slice;
						break;
					}
				}
				period *= interval / sequence.length;
				// If the period of the sequence is one, then we can reduce the quantity of the solve chain of actions too.
				if (interval === 1) {
					// Note that, because normalisation conserves the sign of the quantities of chains (as opposed to canonicalisation), we can't just set the quantity to 1 at this point.
					sequence[0].quantity = Math.sign(sequence[0].quantity);
					period = sequence[0].quantity;
				}
				return sequence.slice(0, interval);
			}

			for (const action of actions) {
				// First, sort the events within the action by value (least to greatest).
				action.events.sort((a, b) => a.value - b.value);
				// Next, collapse adjacent events whose values are equal, and remove any chains of quantity 0.
				action.events = reduceSequence(action.events, (a, b) => a.value == b.value);
			}
			// Now, collapse adjacent actions whose events are the same, and remove any chains of quantity 0.
			const actionEquality = (a, b) => a.events.length === b.events.length && a.events.every(({value, quantity}, index) => value === b.events[index].value && quantity === b.events[index].quantity);
			actions = reduceSequence(actions, actionEquality);
			// Finally, we want to reduce the siteswap to its period, with no repetitions.
			actions = reducePeriod(actions, actionEquality);

			// We now set the period, after we've normalised the siteswap.
			this.period = period;

			let position;

			// Validating the siteswap involves solving a system of linear equations. As a siteswap operates over a hypothetically-infinite set of states, we need to find the range of states over which it actually operates in order to make the problem tractable.
			let [min, max] = [Infinity, -Infinity];
			position = 0;
			for (const action of actions) {
				const values = action.events.map(({value}) => value);
				// If there are a positive quantity of actions in this chain, the events operate on beats to the right of the position. Otherwise, they operate on beats to the left of the position. `offset` is just a shorthand to reference this difference in behaviour.
				const offset = action.quantity > 0 ? 1 : 0;
				// For each action, we need to determine whether it extends the range of states that are operated upon. This can be a little subtle, as the affected states depend both on the quantity of actions in the chain, as well as the sign of the events forming the action.
				// The `indices` are state indices that could possibly be endpoints in the state range for the action.
				// Technically, if the quantity of actions in the chain is 0, this range may be an overestimate. An overly liberal range won't cause any validation issues (though will slightly increase the computational task), because the periodic nature of the siteswap will cause state inconsistencies to propagate throughout the range, meaning the inconsistency will be picked up at validation time regardless. Nevertheless, this is undesirable, and is eliminated by the normalisation of the siteswap earlier.
				const indices = [
					// The following is a possible minimum only if there are any negative events.
					position + 1 + (1 - offset) * action.quantity + Math.min(...values),
					// If there are a positive quantity of actions in this chain, the following represents a possible minimum. Otherwise, it represents a possible maximum.
					position + offset,
					// If there are a positive quantity of actions in this chain, the following represents a possible maximum. Otherwise, it represents a possible minimum.
					position + (1 - offset) * action.quantity,
					// The following is a possible maximum only if there are any positive events.
					position + offset * action.quantity + Math.max(...values)
				];
				// Update the overall range with respect to the action.
				[min, max] = [Math.min(min, ...indices), Math.max(max, ...indices)];
				position += action.quantity;
			}
			
			// In order to validate the siteswap, we build an array the size of the range of states operated upon. For pathological inputs, this could cause issues in terms of memory usage and performance, so we bail out if the size of the state range is too long.
			if (max - min > maximumLength) {
				throw new SiteswapError(`The pattern "${pattern}" has a state range greater than limit of ${maximumLength}.`);
			}

			// We now build the system of equations. This involves calculating the difference, or delta, in each beat after a single operation of the sequence.
			const delta = new Array(max - min + 1).fill(0);
			position = 0;
			for (const action of actions) {
				const increment = Math.sign(action.quantity);
				const offset = action.quantity > 0 ? 1 : 0;
				// The direction we're going to take through the chain of actions depends on the sign of the quantity.
				for (let index = 0; Math.abs(index) < Math.abs(action.quantity); index += increment) {
					// First, for each event in the action, we're going to decrease the delta at the position of the action by one (or increase it if the quantity is negative, as a negative quantity performs the inverse operation).
					delta[position - min + index + offset] -= action.events.reduce((sum, {quantity}) => sum + quantity, 0) * increment;
					// Next, we're going to increase the delta at the destination position of the event by one (or decrease it if the quantity is negative).
					action.events.forEach(({value, quantity}) => delta[position - min + index + offset + value] += quantity * increment);
				}
				position += action.quantity;
			}

			// We can now solve the system of equations by equating the original state with the state produced after the operation of the sequence (represented by the deltas).
			const state = new Array(delta.length).fill(0);
			for (let index = min; index <= max; ++ index) {
				// We're solving the equations by implicitly assuming there is an infinite sequence of 0-beats before the initial state. "Before", in this case, depends on the sign of the period, so we flip the index if the period is negative.
				// `before` represents the position of the beat in the initial state.
				const before = period < 0 ? max + min - index : index;
				// `after` represents the position of the beat after a single operation of the sequence.
				const after = before - period;
				// Solve the linear equation.
				state[before - min] = (after < min || after > max ? 0 : state[after - min]) - delta[before - min];
			}

			// The state before the operation must be the same as the state after the operation. This statement holds if and only if the system of equations is consistent. We've just calculated what the beats in the overlapping range (between the intial state and the state after the operation) must equal in order for the equations to hold. We now just need to check that our assumption, that every beat outside this range is unchanged. If it is not, then for each operation of the sequence, the state is changed, and so the pattern cannot be periodic, which is necessary for the pattern to be valid.
			this.valid = (period > 0 ? state.slice(-period) : state.slice(0, -period)).every((beat) => beat === 0);

			// Convert the normalised sequence of actions to a string for displaying back to the user.
			function sequenceToString(sequence, elementToString) {
				let string = "";
				for (const chain of sequence) {
					string += elementToString(chain);
					if (chain.quantity !== 1) {
						string += `^${convertInteger(chain.quantity)}`;
					}
				}
				return string;
			}

			// The normalised form for the siteswap, as described above.
			this.normalised = sequenceToString(actions, ({events}) => {
				let substring = sequenceToString(events, ({value}) => convertInteger(value));
				if (events.length !== 1 || events[0].quantity !== 1) {
					// If there is only one event in the action, we can use the shorthand notation, without the multiplex brackets.
					return `[${substring}]`;
				}
				return substring;
			});
			// The exact string that was inputted, for user-facing consistency.
			this.pattern = pattern;
		} else {
			throw new SiteswapError(`The string "${pattern}" is syntactically invalid.`);
		}
	}

	static empty (siteswap = new Siteswap()) {
		// The following are a list of properties pertaining to each siteswap (though some may be undefined for certain classes of siteswaps, such as invalid siteswaps).
		siteswap.valid = void 0;
		siteswap.normalised = void 0;
		siteswap.pattern = void 0;
		siteswap.period = void 0;
		siteswap.cardinality = void 0;
		return siteswap;
	}
}

module.exports = {
	Siteswap,
	SiteswapError
};