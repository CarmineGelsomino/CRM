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

    var BUYER_PREFERENCE_KEYS = ["box", "posto_auto", "cantina", "terrazzo", "altro"];

    function createEmptyBuyerProfile() {
        return {
            id: null,
            requested_area: "",
            property_type: "",
            floor_preference: "indifferente",
            purchase_price_renovated: "",
            purchase_price_to_renovate: "",
            mortgage_type: "no",
            mortgage_other: "",
            preferences: {
                box: false,
                posto_auto: false,
                cantina: false,
                terrazzo: false,
                altro: false
            },
            preference_other: ""
        };
    }

    function mapBuyerPreferences(aPreferences) {
        var oPreferences = createEmptyBuyerProfile().preferences;
        var sOtherValue = "";

        (aPreferences || []).forEach(function (oPreference) {
            if (Object.prototype.hasOwnProperty.call(oPreferences, oPreference.preference_type)) {
                oPreferences[oPreference.preference_type] = true;
            }

            if (oPreference.preference_type === "altro") {
                sOtherValue = oPreference.other_value || "";
            }
        });

        return {
            preferences: oPreferences,
            preference_other: sOtherValue
        };
    }

    function buildBuyerPreferencesPayload(oBuyerProfile) {
        return BUYER_PREFERENCE_KEYS
            .filter(function (sKey) {
                return !!oBuyerProfile.preferences[sKey];
            })
            .map(function (sKey) {
                return {
                    preference_type: sKey,
                    other_value: sKey === "altro" ? (oBuyerProfile.preference_other || "").trim() : null
                };
            });
    }

    return BaseController.extend("crm.controller.contactTile.ContactDetail", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");

            this.setModel(new JSONModel({
                contactId: null,
                contact: {},
                buyerProfile: createEmptyBuyerProfile(),
                activities: [],
                notes: []
            }), "contactDetail");

            this.getRouter().getRoute("contactDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var iContactId = Number(oEvent.getParameter("arguments").contactId);
            this.getModel("contactDetail").setProperty("/contactId", iContactId);
            this._loadContact(iContactId).then(function () {
                this._consumePendingPostCreateAction(iContactId);
            }.bind(this));
        },

        _loadContact: async function (iContactId) {
            try {
                var oContact = await ContactApi.getContact(iContactId);
                var oBuyerProfile = createEmptyBuyerProfile();
                var oExistingBuyerProfile = await ContactApi.getBuyerProfileByContactId(iContactId);

                if (oExistingBuyerProfile) {
                    var aPreferences = await ContactApi.listBuyerPreferences(oExistingBuyerProfile.id);
                    oBuyerProfile = Object.assign(oBuyerProfile, oExistingBuyerProfile, mapBuyerPreferences(aPreferences));
                }

                var aActivities = await ContactApi.listActivities(iContactId);
                var aNotes = await ContactApi.listNotes(iContactId);
                var oModel = this.getModel("contactDetail");

                oModel.setProperty("/contact", oContact || {});
                oModel.setProperty("/buyerProfile", oBuyerProfile);
                oModel.setProperty("/activities", aActivities || []);
                oModel.setProperty("/notes", aNotes || []);
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            }
        },

        _consumePendingPostCreateAction: function (iContactId) {
            var oPendingAction = this.getOwnerComponent()._oPendingContactAction;

            if (!oPendingAction || oPendingAction.contactId !== iContactId) {
                return;
            }

            this.getOwnerComponent()._oPendingContactAction = null;

            if (oPendingAction.action === "note") {
                this.onAddNote();
                return;
            }

            if (oPendingAction.action === "activity") {
                this.onAddActivity();
            }
        },

        onSaveContact: async function () {
            var oBundle = this.getResourceBundle();
            var oModel = this.getModel("contactDetail");
            var iContactId = oModel.getProperty("/contactId");
            var oContact = oModel.getProperty("/contact");
            var oBuyerProfile = oModel.getProperty("/buyerProfile") || createEmptyBuyerProfile();

            if (!oContact.first_name || !oContact.last_name) {
                MessageToast.show(oBundle.getText("contactsValidationNameRequired"));
                return;
            }

            try {
                await ContactApi.updateContact(iContactId, oContact);
                await this._saveBuyerProfileData(iContactId, oContact, oBuyerProfile);
                MessageToast.show(oBundle.getText("contactDetailUpdateSuccess"));
                await this._loadContact(iContactId);
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            }
        },

        _saveBuyerProfileData: async function (iContactId, oContact, oBuyerProfile) {
            var oBuyerPayload = {
                contact_id: iContactId,
                requested_area: (oBuyerProfile.requested_area || "").trim(),
                property_type: (oBuyerProfile.property_type || "").trim(),
                floor_preference: oBuyerProfile.floor_preference || "indifferente",
                purchase_price_renovated: oBuyerProfile.purchase_price_renovated || null,
                purchase_price_to_renovate: oBuyerProfile.purchase_price_to_renovate || null,
                mortgage_type: oBuyerProfile.mortgage_type || "no",
                mortgage_other: oBuyerProfile.mortgage_type === "altro" ? (oBuyerProfile.mortgage_other || "").trim() : null
            };

            if (oContact.category !== "acquirente") {
                if (oBuyerProfile.id) {
                    await ContactApi.deleteBuyerProfile(oBuyerProfile.id);
                }
                return;
            }

            var oSavedBuyerProfile = await ContactApi.upsertBuyerProfileByContactId(iContactId, oBuyerPayload);
            await ContactApi.replaceBuyerPreferences(oSavedBuyerProfile.id, buildBuyerPreferencesPayload(oBuyerProfile));
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
            var oBundle = this.getResourceBundle();
            var aActivityTypes = this.getOwnerComponent().getModel("activityTypes").getData() || [];
            var iContactId = this.getModel("contactDetail").getProperty("/contactId");
            var oDialog = new Dialog({
                title: oBundle.getText("contactDetailNewActivityTitle"),
                contentWidth: "30rem",
                state: "Information",
                type: "Message",
                content: [
                    new Label({ text: oBundle.getText("contactDetailActivityFieldTitle"), required: true }),
                    new Input("newActivityTitle"),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldType") }),
                    new Select("newActivityType", {
                        width: "100%",
                        selectedKey: "call",
                        forceSelection: false,
                        items: aActivityTypes.map(function (oType) {
                            return new Item({
                                key: oType.key,
                                text: oBundle.getText(oType.i18n)
                            });
                        })
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldDescription") }),
                    new TextArea("newActivityDescription", { width: "100%", rows: 4 }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldReminder") }),
                    new DateTimePicker("newActivityReminder"),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldPriority") }),
                    new Select("newActivityPriority", {
                        selectedKey: "media",
                        width: "100%",
                        items: [
                            new Item({ key: "bassa", text: oBundle.getText("contactDetailPriorityLow") }),
                            new Item({ key: "media", text: oBundle.getText("contactDetailPriorityMedium") }),
                            new Item({ key: "alta", text: oBundle.getText("contactDetailPriorityHigh") })
                        ]
                    })
                ],
                beginButton: new Button({
                    text: oBundle.getText("contactDetailAddButton"),
                    type: "Emphasized",
                    press: async function () {
                        var sTitle = sap.ui.getCore().byId("newActivityTitle").getValue().trim();

                        if (!sTitle) {
                            MessageToast.show(oBundle.getText("contactDetailActivityTitleRequired"));
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
                            MessageToast.show(oBundle.getText("contactDetailActivityAdded"));
                            oDialog.close();
                            await this._loadContact(iContactId);
                        } catch (oError) {
                            // Error feedback is already handled in ContactApi
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: oBundle.getText("contactsDialogCancelButton"),
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
            var oBundle = this.getResourceBundle();
            var iContactId = this.getModel("contactDetail").getProperty("/contactId");
            var oDialog = new Dialog({
                title: oBundle.getText("contactDetailNewNoteTitle"),
                contentWidth: "28rem",
                state: "Information",
                type: "Message",
                content: [
                    new Label({ text: oBundle.getText("contactDetailNoteFieldText"), required: true }),
                    new TextArea("newNoteMessage", { width: "100%", rows: 6 })
                ],
                beginButton: new Button({
                    text: oBundle.getText("contactDetailAddButton"),
                    type: "Emphasized",
                    press: async function () {
                        var sMessage = sap.ui.getCore().byId("newNoteMessage").getValue().trim();

                        if (!sMessage) {
                            MessageToast.show(oBundle.getText("contactDetailNoteTextRequired"));
                            return;
                        }

                        try {
                            await ContactApi.createNote({ user_id: 1, contact_id: iContactId, message: sMessage });
                            MessageToast.show(oBundle.getText("contactDetailNoteAdded"));
                            oDialog.close();
                            await this._loadContact(iContactId);
                        } catch (oError) {
                            // Error feedback is already handled in ContactApi
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: oBundle.getText("contactsDialogCancelButton"),
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
