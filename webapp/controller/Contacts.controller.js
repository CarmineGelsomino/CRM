sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseController, ContactApi, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.Contacts", {
        onInit: function () {
            this.setModel(new JSONModel({
                filters: {},
                contacts: []
            }), "contacts");

            this.loadContacts();
        },

        loadContacts: async function (mFilters) {
            var oModel = this.getModel("contacts");
            var oAppliedFilters = mFilters || oModel.getProperty("/filters") || {};

            oModel.setProperty("/filters", oAppliedFilters);

            try {
                var aContacts = await ContactApi.listContacts(oAppliedFilters);
                oModel.setProperty("/contacts", aContacts || []);
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        },

        onCreateContact: async function (oPayload) {
            try {
                await ContactApi.createContact(oPayload);
                MessageToast.show("Contatto creato con successo.");
                await this.loadContacts();
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        },

        onDeleteContact: async function (iContactId) {
            try {
                await ContactApi.deleteContact(iContactId);
                MessageToast.show("Contatto eliminato.");
                await this.loadContacts();
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        }
    });
});
