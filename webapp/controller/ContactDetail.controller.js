sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseController, ContactApi, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("crm.controller.ContactDetail", {
        onInit: function () {
            this.setModel(new JSONModel({
                contact: null,
                activities: [],
                notes: []
            }), "contactDetail");
        },

        loadContactDetail: async function (iContactId) {
            var oModel = this.getModel("contactDetail");

            try {
                var oContact = await ContactApi.getContact(iContactId);
                var aActivities = await ContactApi.listActivities(iContactId);
                var aNotes = await ContactApi.listNotes(iContactId);

                oModel.setProperty("/contact", oContact || null);
                oModel.setProperty("/activities", aActivities || []);
                oModel.setProperty("/notes", aNotes || []);
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        },

        onSaveContact: async function (iContactId, oPayload) {
            try {
                await ContactApi.updateContact(iContactId, oPayload);
                MessageToast.show("Contatto aggiornato.");
                await this.loadContactDetail(iContactId);
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        },

        onAddActivity: async function (oPayload) {
            var iContactId = oPayload && oPayload.contact_id;

            try {
                await ContactApi.createActivity(oPayload);
                MessageToast.show("Attività aggiunta.");

                if (iContactId) {
                    await this.loadContactDetail(iContactId);
                }
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        },

        onAddNote: async function (oPayload) {
            var iContactId = oPayload && oPayload.contact_id;

            try {
                await ContactApi.createNote(oPayload);
                MessageToast.show("Nota aggiunta.");

                if (iContactId) {
                    await this.loadContactDetail(iContactId);
                }
            } catch (oError) {
                // Gli errori utente sono già gestiti centralmente nel service.
            }
        }
    });
});
