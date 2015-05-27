var wizardsById = {};
var defaultId = '_defaultId';

Wizard = {};

Wizard.get = function (id) {
    return wizardsById[id || defaultId];
};

Template.registerHelper('pathForStep', function (id) {
    var activeStep = this.wizard.activeStep(false);
    if (activeStep.id === id || !this.data()) {
        return null;
    }
    if (!this.wizard.route) {
        return '#' + id;
    }
    var params = Tracker.nonreactive(function () {
        var route = Router.current()
            , params = route.params || {};

        return _.extend(params, {step: id});
    });
    return Router.path(this.wizard.route, params);
    //return WizardRouter.path(this.wizard.route, id);
});


Template.afWizard.created = function () {
    var id = this.data.id || defaultId;
    this.wizard = wizardsById[id] = new WizardConstructor(this.data);
};

Template.afWizard.destroyed = function () {
    var id = this.data.id || defaultId;

    if (wizardsById[id]) {
        wizardsById[id].destroy();
        delete wizardsById[id];
    }
};

Template.afWizard.helpers({
    innerContext: function (outerContext) {
        var context = this
            , wizard = Template.instance().wizard;

        return _.extend({
            wizard: wizard,
            step: wizard.activeStep()
        }, outerContext);
    },
    activeStepTemplate: function () {
        var activeStep = this.wizard.activeStep();
        return activeStep && (activeStep.template || 'afWizardOneStep') || null;
    }
});

Template.afWizardSteps.events({
    'click a': function (e, tpl) {
        if (!this.wizard.route) {
            e.preventDefault();
            this.wizard.show(this.id);
        }
    }
});

Template.afWizardSteps.helpers({
    activeStepClass: function (id) {
        var activeStep = this.wizard.activeStep();
        return (activeStep && activeStep.id == id) && 'active' || '';
    }
});

// Temporary fix because AutoForm doesn't support reactive schema's
Template.afWizardOneStep.created = function () {
    var self = this;

    this.destroyForm = new ReactiveVar(false);

    this.autorun(function () {
        var data = Blaze.getData();
        self.destroyForm.set(true);
    });

    this.autorun(function () {
        if (self.destroyForm.get()) {
            self.destroyForm.set(false);
        }
    });
};

Template.afWizardOneStep.helpers({
    destroyForm: function () {
        return Template.instance().destroyForm.get();
    }
});

Template.afWizardButtons.events({
    'click .wizard-back-button': function (e) {
        e.preventDefault();
        this.previous();
    }
});

Template.afWizardButtons.helpers({
    showBackButton: function () {
        return this.backButton && !this.isFirstStep();
    }
});

var WizardConstructor = function (options) {
    this._dep = new Tracker.Dependency();

    options = _.chain(options).pick(
        'id',
        'route',
        'steps',
        'stepsTemplate',
        'buttonClasses',
        'nextButton',
        'backButton',
        'confirmButton',
        'persist',
        'clearOnDestroy',
        'doc',
        'collection'
    ).defaults({
            stepsTemplate: 'afWizardSteps',
            nextButton: 'Next',
            backButton: 'Back',
            confirmButton: 'Confirm',
            persist: true
        }).value();

    _.extend(this, options);

    this._stepsByIndex = [];
    this._stepsById = {};

    this.store = new CacheStore(this.id, {
        persist: this.persist !== false
    });

    this.initialize();
};

WizardConstructor.prototype = {

    constructor: WizardConstructor,

    initialize: function () {
        var self = this;

        self.collection = self.collection;
        if (!self.collection && !self.steps) {
            throw new Meteor.Error('collection-or-steps-required', 'AutoFormWizard: You must specify either a collection or a steps array.');
        }

        self.formType = "insert";
        if (self.doc) {
            self.clearData();
            self.formType = "update";
        }

        if (!self.steps) {
            self.collection = AutoForm.Utility.lookup(self.collection);

            if (!self.collection) {
                throw new Meteor.Error('collection-required', 'AutoFormWizard: invalid collection name.');
            }
            var collectionHasSchema = (typeof self.collection.simpleSchema === "function" && self.collection.simpleSchema() != null);
            if (!collectionHasSchema) {
                throw new Meteor.Error('collection-required', 'AutoFormWizard: You must specify a collection with Simple Schema.');
            }

            var ss = self.collection.simpleSchema();

            var allKeys = _.filter(ss._schemaKeys, function (key) {
                var value = ss.schema(key);
                return !(value.autoform && value.autoform.omit);
            });
            var topKeys = _.filter(ss.objectKeys(), function (key) {
                var value = ss.schema(key);
                return !(value.autoform && value.autoform.omit);
            });
            var steps = _.map(topKeys, function (schemaKey) { // iterate over first level keys

                var subKeys = _.filter(allKeys, function (key) {
                    return s.startsWith(key, schemaKey);
                });

                var subSchema = ss.pick(subKeys);

                var schemaOptions = AutoForm.Utility.getDefs(ss, schemaKey).autoform;
                options = _.chain((schemaOptions && schemaOptions.wizard) || {}).pick(
                    'id',
                    'title',
                    'template',
                    'schema',
                    'formId',
                    'onSubmit'
                ).defaults({
                        id: schemaKey,
                        title: ss.label(schemaKey),
                        schema: subSchema  // Returns a schema
                    }).value();

                if (!options.formId) {
                    if (schemaKey === _.last(topKeys)) {
                        options.formId = self.id;
                    } else {
                        options.formId = self.id + '-' + options.id + '-form';
                    }
                }

                if (self.doc) {
                    options.doc = {};
                    options.doc[schemaKey] = self.doc[schemaKey];
                    options.doc._id = self.doc._id;
                }

                return options;
            });

            self.steps = steps;
        }

        _.each(self.steps, function (step) {
            self._initStep(step);
        });

        this._comp = Tracker.autorun(function () {
            var step;
            if (self.route) {
                step = WizardRouter.getStep();
            }
            var active = self._setActiveStep(step);
            if (self.route && active) {
                self.show(active.id);
            }
        });
    },

    _initStep: function (step) {
        var self = this;

        if (step.doc) {
            self.store.set(step.id, step.doc);
        }

        this._stepsByIndex.push(step.id);
        this._stepsById[step.id] = _.extend(step, {
            wizard: self,
            data: function () {
                return self.store.get(step.id) || step.doc;
            }
        });

        AutoForm.addHooks(step.formId, {
            onSubmit: function (data) {
                this.event.preventDefault();
                var autoForm = this;
                if (step.onSubmit) {
                    step.onSubmit.call(this, data, self);
                } else {
                    if (!self.collection || !self.isLastStep()) {
                        self.next(data);
                    } else {
                        if (!self.doc || !self.formType || self.formType === "insert") {
                            self.collection.insert(_.extend(self.mergedData(), data), function (err, id) {
                                if (err) {
                                    autoForm.done(err);
                                } else {
                                    autoForm.done(null, id);
                                }
                            });
                        } else {
                            var allData = _.extend(self.mergedData(), data);
                            self.collection.update({_id: self.doc._id}, {$set: allData}, function (err, res) {
                                autoForm.docId = self.doc._id;
                                if (err) {
                                    autoForm.done(err);
                                } else {
                                    autoForm.done(null, self.doc._id);
                                }
                            });
                        }
                    }
                }
                return false;
            }
        }, true);
    },

    _setActiveStep: function (step) {
        // show the first step if not bound to a route
        if (!step) {
            return this.setStep(0);
        }

        var index = this.indexOf(step)
            , previousStep = this.getStep(index - 1);

        // initial route or non existing step, redirect to first step
        if (index === -1) {
            return this.setStep(0);
        }

        // invalid step
        if (index > 0 && previousStep && !previousStep.data()) {
            return this.setStep(0);
        }

        // valid
        this.setStep(step);
    },

    setData: function (id, data) {
        this.store.set(id, data);
    },

    clearData: function () {
        this.store.clear();
    },

    mergedData: function () {
        var data = {};
        _.each(this._stepsById, function (step) {
            _.extend(data, step.data());
        });
        return data;
    },

    next: function (data) {
        var activeIndex = _.indexOf(this._stepsByIndex, this._activeStepId);

        this.setData(this._activeStepId, data);

        this.show(activeIndex + 1);
    },

    previous: function () {
        var activeIndex = _.indexOf(this._stepsByIndex, this._activeStepId);

        this.setData(this._activeStepId, AutoForm.getFormValues(this.activeStep(false).formId, null, null, false));

        this.show(activeIndex - 1);
    },

    show: function (id) {
        if (typeof id === 'number') {
            id = id in this._stepsByIndex && this._stepsByIndex[id];
        }

        if (!id) return false;

        if (this.route) {
            WizardRouter.go(this.route, id);
        } else {
            this.setStep(id);
        }

        return true;
    },

    getStep: function (id) {
        if (typeof id === 'number') {
            id = id in this._stepsByIndex && this._stepsByIndex[id];
        }

        return id in this._stepsById && this._stepsById[id];
    },

    activeStep: function (reactive) {
        if (reactive !== false) {
            this._dep.depend();
        }
        return this._stepsById[this._activeStepId];
    },

    setStep: function (id) {
        if (typeof id === 'number') {
            id = id in this._stepsByIndex && this._stepsByIndex[id];
        }

        if (!id) return false;

        this._activeStepId = id;
        this._dep.changed();
        return this._stepsById[this._activeStepId];
    },

    isActiveStep: function (id) {
        return id === this._activeStepId;
    },

    isFirstStep: function (id) {
        id = id || this._activeStepId;
        return this.indexOf(id) === 0;
    },

    isLastStep: function (id) {
        id = id || this._activeStepId;
        return this.indexOf(id) === this._stepsByIndex.length - 1;
    },

    indexOf: function (id) {
        return _.indexOf(this._stepsByIndex, id);
    },

    destroy: function () {
        this._comp.stop();

        if (this.clearOnDestroy) this.clearData();
    }
};