import { Dom } from '/static/js/vanilla-js/ui/dom.js';
import { t } from '/static/js/vanilla-js/i18n.js'; 

export class Validator {
	constructor(form, params){
		this.valid = new Set();
		this.invalid = new Set();
		this.form = form;
		this.rules = this.prepareValidationRules(form, params);
		this.submitButton = params.submitButton ? params.submitButton : this.form.find('#submit');
		this.form.valid = false;
		this.tabsSwitcher = params.tabsSwitcher;
		this.uniqueFunction = params.uniqueFunction;

		if (this.submitButton) {
			this.form.on('submit', this.submit.bind(this));
		}

		for (let [field, rulesList] of Object.entries(this.rules)) {
			const element = this.getElement(field);
			if (element) this.listenRules(element, rulesList);
		}
	}

	getElement(name) {
		return this.form.find(`[name=${name}]`)[0] || null;
	}

	listenRules(elem, rule) {
		const eventTypes = "listen" in rule ? rule.listen : 'paste keydown focusout';
		elem.on(eventTypes, (event) => this.handleValidation(event, elem, rule));
	}

	handleValidation(event, elem, rule) {
		if (elem.timeout) clearTimeout(elem.timeout);

		this.clearError(elem);

		if (event.type === 'focusout') {
			if (!elem.value && rule.rules.required && elem.type != "checkbox") {
				this.error(elem, [rule.errors.required]);
				return;
			} else if (elem.invalid) {
				return false;
			}
		}

		if (!event.metaKey && ![8, 9].includes(event.keyCode)) {
			if (rule.rules.max_length && elem.value.length >= rule.rules.max_length) {
				if (elem.selectionEnd === elem.selectionStart) {
					event.preventDefault();
					return false;
				}
			}
			if (event.key && rule.rules.allow_symbols && !event.key.match(rule.rules.allow_symbols)) {
				event.preventDefault();
				return false;
			}
		}

		elem.timeout = setTimeout(() => {
			if (!elem.value && !rule.rules.required && elem.type != "checkbox") return;
			// this.cleanWhitespaces(elem);
			this.validate(elem, rule);
			if (!elem.invalid && rule.unique) this.unique(elem, rule.errors.unique);
		}, rule.timeout || 1000);

		event.stopPropagation();
		return false;
	}

	validate(elem, rules) {
		let errorMsg = [];
		for (let [rule, constraint] of Object.entries(rules.rules)) {
			const isValid = this[rule](elem, constraint);
			isValid ? this.markValid(elem, rules) : errorMsg.push(rules.errors[rule]);
		}

		if(errorMsg.length)
			this.error(elem, errorMsg);

		return errorMsg;
	}

	prepareValidationRules(form, params){
		let validationRules = {};
		form.querySelectorAll('input, select').forEach(inp => {
			if(inp.type == 'hidden' || !inp.name)
				return;

			validationRules[inp.name] = {
				'rules': {},
				'errors': {}
			};

			if(inp.required){
				validationRules[inp.name]['rules']['required'] = true;
				validationRules[inp.name]['errors']['required'] = t('required_error');
			}

			if(inp.maxLength && inp.maxLength > 0){
				validationRules[inp.name]['rules']['max_length'] = inp.maxLength;
				validationRules[inp.name]['errors']['max_length'] = t('max_length_error') + inp.maxLength;
			}

			if(inp.minLength && inp.minLength > 0){
				validationRules[inp.name]['rules']['min_length'] = inp.minLength;
				validationRules[inp.name]['errors']['min_length'] = t('max_length_error') + inp.minLength;
			}
		});

		if (params.rules) {
			for (let field in params.rules) {
				if (!validationRules[field]) {
					validationRules[field] = {};
				}

				if (params.rules[field].rules) {
					validationRules[field].rules = {
						...validationRules[field].rules,
						...params.rules[field].rules
					};
				}

				if (params.rules[field].errors) {
					validationRules[field].errors = {
						...validationRules[field].errors,
						...params.rules[field].errors
					};
				}

				if (params.rules[field].listen)
					validationRules[field].listen = params.rules[field].listen;
			}
		}

		return validationRules;
	}

	required(elem, rule){
		return elem.value && rule;
	}

	is_valid() {
		for (let [key, rule] of Object.entries(this.rules)) {
			let elem = this.getElement(key);
			if (elem) this.validate(elem, rule);
		}

		if (this.invalid.size) {
			this.focusFirstInvalidWithTab();
			return false;
		}
		return true;
	}

	validateTab(elems){
		for(let elem of elems) {
			this.validate(elem, this.rules[elem.name]);
		}

		if (this.invalid.size) {
			this.focusFirstInvalidWithTab();
			return false;
		}

		return true;
	}

	submit(event) {
		for (let [key, rule] of Object.entries(this.rules)) {
			let elem = this.getElement(key);
			if (elem) {
				this.validate(elem, rule);
				if (!elem.invalid && rule.unique) this.unique(elem, rule.errors.unique);
			}
		}

		const recaptcha = Dom.query("#g-recaptcha-response");
		if (!Array.isArray(recaptcha) && !recaptcha.value) {
			event.preventDefault();
			return false;
		}

		if (this.invalid.size) {
			this.focusFirstInvalidWithTab();
			event.preventDefault();
			return false;
		}
	}

	cleanWhitespaces(elem) {
		elem.value = elem.value.trim();
	}

	checked(elem) {
		return elem.checked;
	}

	radio(elem) {
		return !!Dom.query(`[name="${elem.name}"]:checked`)[0];
	}

	equal(elem, rule) {
		return elem.value === this.getElement(rule).value;
	}

	min_length(elem, rule) {
		return elem.value.length >= rule;
	}

	max_length(elem, rule) {
		return elem.value.length <= rule;
	}

	min(elem, rule) {
		return parseFloat(elem.value) >= rule;
	}

	max(elem, rule) {
		return parseFloat(elem.value) <= rule;
	}

	regex(elem, rule) {
		const value = elem.value;
		
		// If rule - an Object with attrs pattern and mask
		if (typeof rule === 'object' && rule.pattern) {
			const matches = value.match(rule.pattern);

			if (matches) {
				// If there is a mask 
				if (rule.mask && typeof rule.mask === 'function') {
					elem.value = rule.mask(matches);
				} else if (rule.mask && typeof rule.mask === 'string') {
					// Apply mask
					let maskedValue = rule.mask;
					matches.forEach((match, index) => {
						maskedValue = maskedValue.replace(`$${index}`, match || '');
					});
					elem.value = maskedValue;
				}
				return true;
			}
			return false;
		}
		
		// If rule is just regular expression
		if (rule instanceof RegExp) {
			return rule.test(value);
		}

		// If rule is string, convert to RegExp
		if (typeof rule === 'string') {
			const regex = new RegExp(rule);
			return regex.test(value);
		}

		return false;
	}

	unique(elem, error) {
		if(this.uniqueFunction)
			this.uniqueFunction(elem, error);
		else
			console.warn("No unique function found. Specify it in Validator initialization.")
	}

	markValid(elem, rules) {
		this.invalid.delete(elem);
		this.valid.add(elem);
		elem.invalid = false;

		if (!this.invalid.size) this.form.triggerValid();
	}

	error(elem, errorMsg) {
		this.triggerError(elem, errorMsg);
		this.invalid.add(elem);
		this.valid.delete(elem);
		elem.invalid = true;

		if(this.tabsSwitcher)
			this.activateTabForElement(elem);
	}

	triggerError(elem, messages){
		let errorBlock;
		if(elem.nodeName == "SELECT"){
			errorBlock = elem.parent().next();
			elem.parent().addClass('invalid');
		}
		else
			errorBlock = elem.next();

		if(!errorBlock)
			throw new Error(`element id ${elem.id}. class errors not found. Example <input...><div class='errors'></div>`);

		if(!errorBlock.hasClass('errors')){
			errorBlock = Dom.query(`.${elem.name}.errors`)[0];
		}

		if(errorBlock){
			messages.forEach((message)=>{
				errorBlock.html(message);
			});
			errorBlock.show();
		}

		if(this.form)
			this.form.triggerInvalid();
	}

	clearError(elem) {
		elem.removeError();
		this.invalid.delete(elem);
		elem.invalid = false;
	}

	focusFirstInvalid() {
		if (this.invalid.size) {
			this.invalid.values().next().value.focus();
		}
	}

	focusFirstInvalidWithTab() {
		if (this.invalid.size) {
			const firstInvalid = this.invalid.values().next().value;
			this.activateTabForElement(firstInvalid);
			firstInvalid.focus();
		}
	}

	activateTabForElement(elem) {
		if (!this.tabsSwitcher) return;

		const tabContainer = elem.closest('.formTab');
		if (!tabContainer){
			console.warn(`Form tab for element ${elem} not found.`);
			return;
		}

		this.tabsSwitcher(tabContainer);
	}

	switchToErrorTab() {
		if (this.invalid.size) {
			const firstInvalid = this.invalid.values().next().value;
			this.activateTabForElement(firstInvalid);
			return true;
		}
		return false;
	}
}