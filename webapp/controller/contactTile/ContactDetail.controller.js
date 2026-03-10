sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/DateTimePicker"
], function (
    BaseController,
    ContactApi,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    Dialog,
    Button,
    Label,
    Input,
    TextArea,
    Select,
    Item,
    DateTimePicker
) {
    "use strict";

    return BaseController.extend("crm.controller.contactTile.ContactDetail", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");

            this.setModel(new JSONModel({
                contactId: null,
                contact: {},
                activities: [],
                notes: []
            }), "contactDetail");

            this.getRouter().getRoute("contactDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var iContactId = Number(oEvent.getParameter("arguments").contactId);
            this.getModel("contactDetail").setProperty("/contactId", iContactId);
            this._loadContact(iContactId);
        },

        _loadContact: async function (iContactId) {
            try {
                var oContact = await ContactApi.getContact(iContactId);
                var aActivities = await ContactApi.listActivities(iContactId);
                var aNotes = await ContactApi.listNotes(iContactId);
                var oModel = this.getModel("contactDetail");

                oModel.setProperty("/contact", oContact || {});
                oModel.setProperty("/activities", aActivities || []);
                oModel.setProperty("/notes", aNotes || []);
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            }
        },

        onSaveContact: async function () {
            var oModel = this.getModel("contactDetail");
            var iContactId = oModel.getProperty("/contactId");
            var oContact = oModel.getProperty("/contact");

            if (!oContact.first_name || !oContact.last_name) {
                MessageToast.show("Nome e cognome sono obbligatori.");
                return;
            }

            try {
                await ContactApi.updateContact(iContactId, oContact);
                MessageToast.show("Contatto aggiornato.");
                await this._loadContact(iContactId);
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            }
        },

        onFilterActivities: function (oEvent) {
            var oSource = oEvent.getSource();
            var sQuery = "";

            if (oSource.isA("sap.m.SearchField")) {
                sQuery = (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim();
            } else {
                sQuery = (this.byId("activitySearchField").getValue() || "").trim();
            }

            var sStatus = this.byId("activityStatusFilter").getSelectedKey();
            var aFilters = [];

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("title", FilterOperator.Contains, sQuery),
                        new Filter("description", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            this.byId("activitiesList").getBinding("items").filter(aFilters, "Application");
        },

        onFilterNotes: function (oEvent) {
            var sQuery = (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim();
            var aFilters = sQuery ? [new Filter("message", FilterOperator.Contains, sQuery)] : [];
            this.byId("notesList").getBinding("items").filter(aFilters, "Application");
        },

        onAddActivity: function () {
            var iContactId = this.getModel("contactDetail").getProperty("/contactId");
            var oDialog = new Dialog({
                title: "Nuova attività",
                contentWidth: "30rem",
                content: [
                    new Label({ text: "Titolo", required: true }),
                    new Input("newActivityTitle"),
                    new Label({ text: "Tipo attività" }),
                    new Select("newActivityType", {
                        selectedKey: "call",
                        items: [
                            new Item({ key: "call", text: "Telefonata" }),
                            new Item({ key: "meeting", text: "Appuntamento" }),
                            new Item({ key: "email", text: "Email" }),
                            new Item({ key: "todo", text: "To-do" })
                        ]
                    }),
                    new Label({ text: "Descrizione" }),
                    new TextArea("newActivityDescription", { rows: 4 }),
                    new Label({ text: "Promemoria" }),
                    new DateTimePicker("newActivityReminder"),
                    new Label({ text: "Priorità" }),
                    new Select("newActivityPriority", {
                        selectedKey: "media",
                        items: [
                            new Item({ key: "bassa", text: "Bassa" }),
                            new Item({ key: "media", text: "Media" }),
                            new Item({ key: "alta", text: "Alta" })
                        ]
                    })
                ],
                beginButton: new Button({
                    text: "Aggiungi",
                    type: "Emphasized",
                    press: async function () {
                        var sTitle = sap.ui.getCore().byId("newActivityTitle").getValue().trim();
                        if (!sTitle) {
                            MessageToast.show("Il titolo attività è obbligatorio.");
                            return;
                        }

                        var oPayload = {
                            user_id: 1,
                            contact_id: iContactId,
                            title: sTitle,
                            activity_type: sap.ui.getCore().byId("newActivityType").getSelectedKey(),
                            description: sap.ui.getCore().byId("newActivityDescription").getValue(),
                            reminder_at: sap.ui.getCore().byId("newActivityReminder").getValue(),
                            priority: sap.ui.getCore().byId("newActivityPriority").getSelectedKey(),
                            status: "todo"
                        };

                        try {
                            await ContactApi.createActivity(oPayload);
                            MessageToast.show("Attività aggiunta.");
                            oDialog.close();
                            await this._loadContact(iContactId);
                        } catch (oError) {
                            // Error feedback is already handled in ContactApi
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "Annulla",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onAddNote: function () {
            var iContactId = this.getModel("contactDetail").getProperty("/contactId");
            var oDialog = new Dialog({
                title: "Nuova nota",
                contentWidth: "28rem",
                content: [
                    new Label({ text: "Testo nota", required: true }),
                    new TextArea("newNoteMessage", { rows: 6 })
                ],
                beginButton: new Button({
                    text: "Aggiungi",
                    type: "Emphasized",
                    press: async function () {
                        var sMessage = sap.ui.getCore().byId("newNoteMessage").getValue().trim();
                        if (!sMessage) {
                            MessageToast.show("Inserisci il testo della nota.");
                            return;
                        }

                        try {
                            await ContactApi.createNote({ user_id: 1, contact_id: iContactId, message: sMessage });
                            MessageToast.show("Nota aggiunta.");
                            oDialog.close();
                            await this._loadContact(iContactId);
                        } catch (oError) {
                            // Error feedback is already handled in ContactApi
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "Annulla",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
