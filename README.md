# AutoForm Wizard

AutoForm Wizard is a multi step form component for AutoForm originally made by [forwarder](https://github.com/forwarder/meteor-wizard).

This is a fork with the following changes and additions:
* Steps configuration are inferred from the collection's schema, so no need to manually configure them (although it's still be possible, but needs further testing);
  * Steps configuration can be overridden inside the schema definition (using `autoform: { wizard: {}}`); 
* Support for easily editing an existing item: just call the wizard template specifying a `doc` attribute; 
* `onSubmit` is handled automatically (can be overridden), and other AutoForm hooks can be used (like `onSuccess` and `onError`);
* Steps name's are automatically handled, so there's no need to manually specify the first step in the router (although there needs to be a route that deals with a `step` parameter and which has to be specified in the `route` attribute in when calling the `afWizard` template). 

To do:
* Further testing;
* Use template themes like AutoForm's.


## Installation

```
$ meteor add kepler:autoform-wizard
```


## Dependencies

* AutoForm versions 5.
* Iron Router support is optional, works with version 1.


## Example

~~A running example can be found here: http://autoform-wizard.meteor.com~~

The source code of the adapted example app can be found on Github: https://github.com/kepler/meteor-autoform-wizard-example

Attach a schema to a collection as you normally would with [AutoForm](https://github.com/aldeed/meteor-autoform).

```js
Schema = {};
Schema.information = new SimpleSchema(...);
Schema.confirm = new SimpleSchema(...);

Schema.Orders = new SimpleSchema({
    contactInformation: {
        type: Schema.information
    },
    confirm: {
        type: Schema.confirm
    }
});

Orders.attachSchema(Schema.Orders);
```

### A Basic Insert Wizard

```html
<template name="newOrder">
    {{> afWizard id="order" collection="Orders"}}
</template>
```

This will generate a two steps wizard:
* One step to fill in the information schema;
* A second step to fill in the confirm schema.

That's it. Each first level field in the collection's schema will be rendered as a separate step. The last step will merge the values from all steps and insert them into the "Orders" collection.

Please note I have not tested it with first level array fields.


### A Basic Update Wizard

```html
<template name="updateOrder">
    {{> afWizard id="order" collection="Orders" doc=this}}
</template>
```

As with AutoForm's behaviour, you just need to additionally pass a `doc` attribute. In the example we use `doc=this` since we use iron:router's data function to set the template's data context to the order document.


### Define the steps in a template helper

The [original way of defining steps](https://github.com/forwarder/meteor-wizard#define-the-steps-in-a-template-helper) should still work: 

```js
Template.basicWizard.helpers({
  steps: function() {
    return [{
      id: 'information',
      title: 'Information',
      schema: Schema.information
    },{
      id: 'confirm',
      title: 'Confirm',
      schema: Schema.confirm,
      onSubmit: function(data, wizard) {
        // submit logic
      }
    }]
  }
});
```


### Configure the steps in the collection

If you want to use steps defined via schema fields and still be able to specify custom options, you can specify the [configuration keys](#wizard-configuration) directly inside the collection's schema to override the default values:

```js
Schema = {};
Schema.information = new SimpleSchema(...);
Schema.confirm = new SimpleSchema(...);

Schema.Orders = new SimpleSchema({
    contactInformation: {
        type: Schema.information,
        autoform: {
            wizard: {
                title: 'Information'
            }
        }
    },
    confirm: {
        type: Schema.confirm,
        autoform: {
            wizard: {
                title: 'Confirmation',
                onSubmit: function(data, wizard) {
                    // submit logic
                }
            }
        }
    }
});

Orders.attachSchema(Schema.Orders);
```

Please note that not every option was thoroughly tested, specially the `schema` field, which might produce unpredictable behaviour.


## Custom step templates

If you need more flexibility in your forms, you can define your own templates to be used for the steps.

### Define your templates and include AutoForm

```html
<template name="information">
    {{> quickform id=step.formId doc=step.data schema=step.schema}}
</template>
```

or

```html
<template name="confirm">
    {{#autoForm id=step.formId doc=step.data schema=step.schema}}
        {{> afQuickField name="acceptTerms"}}
        {{> afWizardButtons}} /* this will render back, next and confirm buttons */
    {{/autoForm}}
</template>
```

or even

```html
<template name="information">
    {{#autoForm id=step.formId doc=step.data schema=step.schema}}
        {{#each afFieldNames}}
            {{> afQuickField name=this.name options=afOptionsFromSchema}}
        {{/each}}
        {{> afWizardButtons}}
    {{/autoForm}}
</template>
```

Note that using the `quickform` template will not produce the `Back` and `Next` buttons, although the `Submit` button will effectively either go to the next step or submit the form if on the last step.

Also note that you should provide the `schema` attribute and not the `collection` attribute to the `autoForm` and `quickform` templates, otherwise the entire form will be rendered.

### Configure steps

Use the `template` key:

```js
Schema.Orders = new SimpleSchema({
    contactInformation: {
        type: Schema.information,
        autoform: {
            wizard: {
                title: 'Information',
                template: 'information'
            }
        }
    },
    ...
});
```

## Component reference

### Wizard configuration

The following attributes are supported:

* `id`: Required. The id used to identify the wizard.
* `route`: Optional. The (Iron Router) route name this wizard will be bound to, the route needs a `step` parameter.
* `steps`: Required. A list of steps for this wizard.
  * `id`: Required. Id of the step, also used for the route parameter.
  * `title`: Optional. The title displayed in the breadcrumbs.
  * `template`: Optional. Uses a default template with a quickform if not set.
  * `schema`: Optional. Only required if don't use a custom template.
  * `formId`: Optional. The AutoForm form id used in the template. Concatenates the wizard.id, the step.id and '-form' if not set. Used to attach submit handlers and retrieve the step data.
  * `onSubmit`: Optional. This function is executed after the form is submitted and validates. `this` references to the AutoForm instance. Shows the next step by default. Parameters:
      * `data`: The current step data.
      * `wizard`: The wizard instance.
* `buttonClasses`: Optional. CSS classes to add to the buttons.
* `nextButton`: Optional. Defaults to `Next`.
* `backButton`: Optional. Defaults to `Back`. Set to `false`, to not render this button.
* `confirmButton`: Optional. Defaults to `Confirm`.
* `persist`: Optional. Persist the step data in localStorage. Defaults to `true`.
* `clearOnDestroy`: Optional. Clear the cache storage after closing the wizard. Defaults to `false`.
* `stepsTemplate`: Optional. A custom steps template.

#### onSubmit

Use this callback to process the form data.
```js
onSubmit: function(data, wizard) {
  var self = this;
  Orders.insert(_.extend(wizard.mergedData(), data), function(err, id) {
    if (err) {
      self.done();
    } else {
      Router.go('viewOrder', {
        _id: id
      });
    }
  });
}
```

Arguments:

* `data`: Form data of the current step.
* `wizard`: The wizard instance.

`this` references to the AutoForm instance, see the [AutoForm documentation](https://github.com/aldeed/meteor-autoform#onsubmit) for more information.

### Wizard instance methods

The wizard instance is added to your step templates data context, so you can access these methods in your event handlers etc.

* `mergedData()`: Get all data from previous steps. Does not include data of the current step in the onSubmit callback.
* `next()`: Go to the next step.
* `previous()`: Go to the previous step.
* `show(id)`: Show a specific step by id or index.
* `isFirstStep([id])`: Omit the id argument to use the active step.
* `isLastStep([id])`: Omit the id argument to use the active step.
* `indexOf(id)`: Get the index of the specified step id.

Example usage:
```js
Template.wizardStep2.events({
  'click .back': function(e, template) {
    e.preventDefault();
    this.wizard.previous();
  }
});
```


## Using routers

It's possible to bind the wizard to a router. Iron Router support is supported by default.
If you're using a different router, it's easy to setup custom bindings.

### Iron Router

Add a new route to your router config, with the :step parameter.
```js
Router.route('/order/:step', {name: 'order'});
```

Add a route parameter with the name of the route to your wizard instance.
```
{{> afWizard id="order" collection="Orders" route="order"}}
```

To automatically redirect to the first step, specify a route to the template that includes the `afWizard` template and also a route for steps:
```js
Router.route('/order/new', {
    name: 'newOrder'
});

Router.route('/order/new/:step', {
    name: 'newOrderStep',
    template: 'newOrder'
});
```

Then in the `newOrder` template, tell the wizard to use the route for steps:
```
{{> afWizard id="order" collection="Orders" route="newOrderStep"}}
```

Now accessing `/order/new` will redirect to `/order/new/information`, for example.

Also, any URL with an invalid step name will redirect to the first step URL. 

### Custom router bindings

Check [Forwarder's documentation](https://github.com/forwarder/meteor-wizard#custom-router-bindings).

## Change log

`0.0.2`

* Fix issue with picking simple schema fields that are arrays (see https://github.com/aldeed/meteor-simple-schema/issues/284).
* The last step's formId is set to the wizard's id, for making it easier to add hooks.
