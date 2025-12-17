import { GET } from "/static/js/vanilla-js/http/navigation.js";

class ValueManager {
    constructor(hiddenInput) {
        this.hidden = hiddenInput || null;
    }

    getValues() {
        if (!this.hidden || !this.hidden.value) return [];
        try {
            return JSON.parse(this.hidden.value);
        } catch {
            return this.hidden.value ? [this.hidden.value] : [];
        }
    }

    setValues(values) {
        if (!this.hidden) return;
        if (Array.isArray(values)) {
            this.hidden.value = JSON.stringify(values);
        } else {
            this.hidden.value = values ? values.toString() : '';
        }
    }

    addValue(id) {
        let values = this.getValues();
        if (!values.includes(id)) values.push(id);
        this.setValues(values);
    }

    removeValue(id) {
        let values = this.getValues();
        if (Array.isArray(values)) {
            values = values.filter(v => v !== id);
        } else {
            values = '';
        }
        this.setValues(values);
    }
}

export class Autocomplete {
    constructor(context) {
        this.container = context.container;
        this.AdminModel = context.Model || context.AdminModel;
        this.success = context.success || null;
        this.minLength = context.minLength || 3;
        this.delay = context.delay || 500;

        this.variantsContainer = this.container.find('.variants')[0];
        this.hidden = this.container.find('input[type="hidden"]')[0] || null;
        this.textInput = this.container.find('input[type="text"]')[0];
        this.valuesContainer = this.container.find('.values')[0] || null;
        this.removeButton = this.container.find('.remove');

        this.timeout = null;
        this.active = null;

        this.bindEvents();
    }

    bindEvents() {
        this.textInput.on('paste keydown', this.handleKey.bind(this));
        if (this.removeButton) this.removeButton.on('click', this.remove.bind(this));
    }

    handleKey(e) {
        switch (e.keyCode) {
            case 13: this.press_enter(e); break;
            case 38: this.press_up(e); break;
            case 40: this.press_down(e); break;
            default: this.autocomplete(e);
        }
        e.stopPropagation();
        return false;
    }

    autocomplete(e) {
        if (this.timeout) clearTimeout(this.timeout);

        const input = e.target.value;
        if (input.length < this.minLength) return;

        this.timeout = setTimeout(() => {
            GET(`/autocomplete/${this.AdminModel}/${input}`, {
                success: (response) => {
                    Dom.render("#variants", this.variantsContainer, response);
                    this.container.find('.variant, .variants div').on('click', this.success || this.add.bind(this));
                    this.variantsContainer.show();
                }
            });
        }, this.delay);
    }

    add(event) {
        const id = parseInt(event.target.get('value'));
        const name = event.target.text();

        if(this.hidden.value !== id){
            this.hidden.value = id;
            this.addValue(id, name);
        }

        this.variantsContainer.hide();
        this.variantsContainer.clear();
        this.textInput.value = '';
    }

    addValue(id, name) {
        if (this.valuesContainer) {
            this.valuesContainer.clear();
            Dom.render("#autocomplete_value", this.valuesContainer, {
                id, name, AdminModel: this.AdminModel
            });
            Dom.query(`.autocomplete.${this.AdminModel} .remove[value="${id}"]`).on('click', this.remove.bind(this));

            lucide.createIcons( lucide.icons );
        }
    }

    remove(e) {
        const id = parseInt(e.target.get('value'));

        if (!id) {
            e.target.parent().click();
            return false;
        }

        this.hidden.value = "";
        e.target.parent().remove();
    }

    press_enter(e) {
        const item = this.container.find('.variants .active')[0];
        if (item) {
            e = { target: item };
            (this.success || this.add.bind(this))(e);
        }
    }

    press_down() {
        const list = this.container.find('.variants')[0];
        if (!this.active) {
            this.active = list.first();
        } else {
            this.active.removeClass('active');
            this.active = this.active.next() || list.first();
        }
        this.active.addClass('active');
    }

    press_up() {
        const list = this.container.find('.variants')[0];
        if (!this.active) {
            this.active = list.last();
        } else {
            this.active.removeClass('active');
            this.active = this.active.prev() || list.last();
        }
        this.active.addClass('active');
    }
}

export class AutocompleteMultiple extends Autocomplete{
    constructor(context) {
        super(context);

        this.valueManager = new ValueManager(this.hidden);
    }

    add(event) {
        const id = parseInt(event.target.get('value'));
        const name = event.target.text();
        const values = this.valueManager.getValues();

        if (!this.hidden) {
            this.textInput.value = name;
            this.variantsContainer.hide();
            return;
        }

        if(!values.includes(id))
            this.addValue(id, name);

        this.variantsContainer.hide();
        this.variantsContainer.clear();
        this.textInput.value = '';
    }

    addValue(id, name) {
        this.valueManager.addValue(id);

        if (this.valuesContainer) {
            Dom.render("#autocomplete_value", this.valuesContainer, {
                id, name, AdminModel: this.AdminModel
            });
            Dom.query(`.autocomplete.${this.AdminModel} .remove[value="${id}"]`).on('click', this.remove.bind(this));

            lucide.createIcons( lucide.icons );
        }
    }

    remove(e) {
        const id = parseInt(e.target.get('value'));

        if (!id) {
            e.target.parent().click();
            return false;
        }

        this.valueManager.removeValue(id);
        e.target.parent().remove();
    }

}