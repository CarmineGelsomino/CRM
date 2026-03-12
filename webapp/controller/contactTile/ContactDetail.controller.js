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
    "sap/m/DateTimePicker",
    "sap/m/library",
    "sap/m/MessageBox",
    "sap/ui/core/ListItem"
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
    DateTimePicker,
    mobileLibrary,
    MessageBox,
    ListItem
) {
    "use strict";

    var BUYER_PREFERENCE_KEYS = ["box", "posto_auto", "cantina", "terrazzo", "altro"];
    var URLHelper = mobileLibrary.URLHelper;

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

    function createEmptyAdditionalPhone() {
        return {
            phone: ""
        };
    }

    function createEmptyAdditionalAddress() {
        return {
            address_line: ""
        };
    }

    function createEmptySellerProperty() {
        return {
            property_id: null,
            display_value: ""
        };
    }

    function formatPropertyDisplay(oProperty) {
        var sAddress = (oProperty && oProperty.address_line || "").trim();
        var sSubalterno = (oProperty && oProperty.subalterno || "").trim();
        return sSubalterno ? sAddress + " - Sub. " + sSubalterno : sAddress;
    }

    function normalizeSearchValue(sValue) {
        return (sValue || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function normalizePhoneList(sPrimaryPhone, aAdditionalPhones) {
        var aPhones = [];
        var sCleanPrimaryPhone = (sPrimaryPhone || "").trim();

        if (sCleanPrimaryPhone) {
            aPhones.push({
                phone: sCleanPrimaryPhone,
                is_primary: 1
            });
        }

        (aAdditionalPhones || []).forEach(function (oPhone) {
            var sPhone = (oPhone && oPhone.phone || "").trim();

            if (sPhone) {
                aPhones.push({
                    phone: sPhone,
                    is_primary: 0
                });
            }
        });

        return aPhones;
    }

    function normalizeAddressList(sPrimaryAddress, aAdditionalAddresses) {
        var aAddresses = [];
        var sCleanPrimaryAddress = (sPrimaryAddress || "").trim();

        if (sCleanPrimaryAddress) {
            aAddresses.push({
                address_line: sCleanPrimaryAddress,
                country: "Italia",
                is_primary: 1
            });
        }

        (aAdditionalAddresses || []).forEach(function (oAddress) {
            var sAddress = (oAddress && oAddress.address_line || "").trim();

            if (sAddress) {
                aAddresses.push({
                    address_line: sAddress,
                    country: "Italia",
                    is_primary: 0
                });
            }
        });

        return aAddresses;
    }

    return BaseController.extend("crm.controller.contactTile.ContactDetail", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");

            this.setModel(new JSONModel({
                contactId: null,
                contact: {},
                phones: [],
                addresses: [],
                sellerProperties: [createEmptySellerProperty()],
                buyerProfile: createEmptyBuyerProfile(),
                activities: [],
                notes: []
            }), "contactDetail");

            this._aPropertyCache = null;

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
                var aContactPhones = await ContactApi.listContactPhones(iContactId);
                var aContactAddresses = await ContactApi.listContactAddresses({ contact_id: iContactId });
                var aSellerProperties = await this._loadSellerPropertiesForContact(iContactId);
                var oBuyerProfile = createEmptyBuyerProfile();
                var oExistingBuyerProfile = await ContactApi.getBuyerProfileByContactId(iContactId);

                if (oExistingBuyerProfile) {
                    var aPreferences = await ContactApi.listBuyerPreferences(oExistingBuyerProfile.id);
                    oBuyerProfile = Object.assign(oBuyerProfile, oExistingBuyerProfile, mapBuyerPreferences(aPreferences));
                }

                var aActivities = await ContactApi.listActivities(iContactId);
                var aNotes = await ContactApi.listNotes(iContactId);
                var oModel = this.getModel("contactDetail");
                var oPrimaryPhone = (aContactPhones || []).find(function (oPhone) {
                    return Number(oPhone.is_primary) === 1;
                });
                var oPrimaryAddress = (aContactAddresses || []).find(function (oAddress) {
                    return Number(oAddress.is_primary) === 1;
                });

                oModel.setProperty("/contact", Object.assign({}, oContact || {}, {
                    primary_phone: (oPrimaryPhone && oPrimaryPhone.phone) || (oContact && oContact.primary_phone) || "",
                    primary_address: (oPrimaryAddress && oPrimaryAddress.address_line) || (oContact && oContact.primary_address) || ""
                }));
                oModel.setProperty("/phones", (aContactPhones || []).filter(function (oPhone) {
                    return Number(oPhone.is_primary) !== 1;
                }).map(function (oPhone) {
                    return { phone: oPhone.phone || "" };
                }));
                oModel.setProperty("/addresses", (aContactAddresses || []).filter(function (oAddress) {
                    return Number(oAddress.is_primary) !== 1;
                }).map(function (oAddress) {
                    return { address_line: oAddress.address_line || "" };
                }));
                oModel.setProperty("/sellerProperties", aSellerProperties);
                oModel.setProperty("/buyerProfile", oBuyerProfile);
                oModel.setProperty("/activities", aActivities || []);
                oModel.setProperty("/notes", aNotes || []);
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            }
        },

        _ensurePropertyCache: async function () {
            if (!this._aPropertyCache) {
                this._aPropertyCache = await ContactApi.listProperties();
            }

            return this._aPropertyCache || [];
        },

        _loadSellerPropertiesForContact: async function (iContactId) {
            var aOwners = await ContactApi.listPropertyOwners({ contact_id: iContactId });

            if (!aOwners || !aOwners.length) {
                return [createEmptySellerProperty()];
            }

            var aProperties = await this._ensurePropertyCache();
            var mPropertiesById = (aProperties || []).reduce(function (mMap, oProperty) {
                mMap[oProperty.id] = oProperty;
                return mMap;
            }, {});
            var aSellerProperties = aOwners.map(function (oOwner) {
                var oProperty = mPropertiesById[oOwner.property_id];
                return {
                    property_id: oOwner.property_id,
                    display_value: formatPropertyDisplay(oProperty)
                };
            }).filter(function (oSellerProperty) {
                return !!oSellerProperty.display_value;
            });

            return aSellerProperties.length ? aSellerProperties : [createEmptySellerProperty()];
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

            if (!this._validateSellerProperties(oModel.getProperty("/sellerProperties"), oContact.category)) {
                return;
            }

            try {
                await ContactApi.updateContact(iContactId, oContact);
                await this._saveContactPhones(iContactId, oContact, oModel.getProperty("/phones"));
                await this._saveContactAddresses(iContactId, oContact, oModel.getProperty("/addresses"));
                await this._saveBuyerProfileData(iContactId, oContact, oBuyerProfile);
                await this._saveSellerProperties(iContactId, oContact.category, oModel.getProperty("/sellerProperties"));
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

        _saveContactPhones: async function (iContactId, oContact, aAdditionalPhones) {
            await ContactApi.replaceContactPhones(iContactId, normalizePhoneList(oContact.primary_phone, aAdditionalPhones));
        },

        _saveContactAddresses: async function (iContactId, oContact, aAdditionalAddresses) {
            await ContactApi.replaceContactAddresses(iContactId, normalizeAddressList(oContact.primary_address, aAdditionalAddresses));
        },

        onAddPhone: function () {
            var oModel = this.getModel("contactDetail");
            var aPhones = oModel.getProperty("/phones") || [];

            aPhones.push(createEmptyAdditionalPhone());
            oModel.setProperty("/phones", aPhones);
        },

        onRemovePhone: function (oEvent) {
            var oModel = this.getModel("contactDetail");
            var oContext = oEvent.getSource().getBindingContext("contactDetail");
            var sPath = oContext && oContext.getPath();
            var aPhones = oModel.getProperty("/phones") || [];
            var iIndex;

            if (!sPath) {
                return;
            }

            iIndex = Number(sPath.split("/").pop());

            if (Number.isNaN(iIndex)) {
                return;
            }

            aPhones.splice(iIndex, 1);
            oModel.setProperty("/phones", aPhones);
        },

        onAddAddress: function () {
            var oModel = this.getModel("contactDetail");
            var aAddresses = oModel.getProperty("/addresses") || [];

            aAddresses.push(createEmptyAdditionalAddress());
            oModel.setProperty("/addresses", aAddresses);
        },

        onRemoveAddress: function (oEvent) {
            var oModel = this.getModel("contactDetail");
            var oContext = oEvent.getSource().getBindingContext("contactDetail");
            var sPath = oContext && oContext.getPath();
            var aAddresses = oModel.getProperty("/addresses") || [];
            var iIndex;

            if (!sPath) {
                return;
            }

            iIndex = Number(sPath.split("/").pop());

            if (Number.isNaN(iIndex)) {
                return;
            }

            aAddresses.splice(iIndex, 1);
            oModel.setProperty("/addresses", aAddresses);
        },

        onAddSellerProperty: function () {
            var oModel = this.getModel("contactDetail");
            var aSellerProperties = oModel.getProperty("/sellerProperties") || [];

            aSellerProperties.push(createEmptySellerProperty());
            oModel.setProperty("/sellerProperties", aSellerProperties);
        },

        onRemoveSellerProperty: function (oEvent) {
            var oModel = this.getModel("contactDetail");
            var oContext = oEvent.getSource().getBindingContext("contactDetail");
            var sPath = oContext && oContext.getPath();
            var aSellerProperties = oModel.getProperty("/sellerProperties") || [];
            var iIndex;

            if (!sPath) {
                return;
            }

            iIndex = Number(sPath.split("/").pop());

            if (Number.isNaN(iIndex)) {
                return;
            }

            aSellerProperties.splice(iIndex, 1);

            if (!aSellerProperties.length) {
                aSellerProperties.push(createEmptySellerProperty());
            }

            oModel.setProperty("/sellerProperties", aSellerProperties);
        },

        onSellerPropertyLiveChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext("contactDetail");
            var oModel = oInput.getModel("contactDetail");

            if (!oContext || !oModel) {
                return;
            }

            oModel.setProperty(oContext.getPath() + "/display_value", oEvent.getParameter("value"));
            oModel.setProperty(oContext.getPath() + "/property_id", null);
        },

        onSuggestSellerProperty: async function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = normalizeSearchValue(oEvent.getParameter("suggestValue"));
            var aProperties = await this._ensurePropertyCache();
            var aMatches = [];

            if (sValue.length < 3) {
                oInput.destroySuggestionItems();
                return;
            }

            aMatches = (aProperties || []).filter(function (oProperty) {
                return normalizeSearchValue(formatPropertyDisplay(oProperty)).indexOf(sValue) !== -1;
            }).slice(0, 10);

            oInput.destroySuggestionItems();
            aMatches.forEach(function (oProperty) {
                oInput.addSuggestionItem(new ListItem({
                    key: String(oProperty.id),
                    text: formatPropertyDisplay(oProperty),
                    additionalText: (oProperty.city || "").trim()
                }));
            });
        },

        onSellerPropertySelected: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext("contactDetail");
            var oModel = oInput.getModel("contactDetail");
            var iPropertyId;

            if (!oSelectedItem || !oContext || !oModel) {
                return;
            }

            iPropertyId = Number(oSelectedItem.getKey());
            oModel.setProperty(oContext.getPath() + "/property_id", iPropertyId);
            oModel.setProperty(oContext.getPath() + "/display_value", oSelectedItem.getText());
        },

        _normalizeSellerPropertiesForSave: function (aSellerProperties) {
            return (aSellerProperties || []).filter(function (oSellerProperty) {
                return (oSellerProperty.display_value || "").trim();
            }).map(function (oSellerProperty, iIndex) {
                return {
                    property_id: oSellerProperty.property_id,
                    is_primary_owner: iIndex === 0 ? 1 : 0,
                    display_value: (oSellerProperty.display_value || "").trim()
                };
            });
        },

        _validateSellerProperties: function (aSellerProperties, sCategory) {
            var oBundle = this.getResourceBundle();

            if (sCategory !== "venditore") {
                return true;
            }

            if (this._normalizeSellerPropertiesForSave(aSellerProperties).some(function (oSellerProperty) {
                return !oSellerProperty.property_id;
            })) {
                MessageToast.show(oBundle.getText("contactsDialogSellerPropertyValidation"));
                return false;
            }

            return true;
        },

        _saveSellerProperties: async function (iContactId, sCategory, aSellerProperties) {
            if (sCategory !== "venditore") {
                await ContactApi.replacePropertyOwners(iContactId, []);
                return;
            }

            await ContactApi.replacePropertyOwners(iContactId, this._normalizeSellerPropertiesForSave(aSellerProperties).map(function (oSellerProperty) {
                return {
                    property_id: oSellerProperty.property_id,
                    is_primary_owner: oSellerProperty.is_primary_owner
                };
            }));
        },

        onOpenMissingPropertyDialog: function () {
            var oBundle = this.getResourceBundle();

            MessageBox.show(oBundle.getText("contactsDialogMissingPropertyPrompt"), {
                icon: MessageBox.Icon.QUESTION,
                title: oBundle.getText("contactsDialogMissingPropertyTitle"),
                actions: [
                    oBundle.getText("contactsDialogMissingPropertyActionHere"),
                    oBundle.getText("contactsDialogMissingPropertyActionModule"),
                    MessageBox.Action.CANCEL
                ],
                emphasizedAction: oBundle.getText("contactsDialogMissingPropertyActionHere"),
                onClose: function (sAction) {
                    if (sAction === oBundle.getText("contactsDialogMissingPropertyActionHere")) {
                        this._openInlinePropertyPlaceholderDialog();
                        return;
                    }

                    if (sAction === oBundle.getText("contactsDialogMissingPropertyActionModule")) {
                        this._openPropertyModulePlaceholder();
                    }
                }.bind(this)
            });
        },

        _openInlinePropertyPlaceholderDialog: function () {
            var oBundle = this.getResourceBundle();

            MessageBox.information(oBundle.getText("contactsDialogMissingPropertyHerePlaceholder"), {
                title: oBundle.getText("contactsDialogMissingPropertyHereTitle")
            });
        },

        _openPropertyModulePlaceholder: function () {
            var oBundle = this.getResourceBundle();

            MessageToast.show(oBundle.getText("contactsDialogMissingPropertyModulePlaceholder"));
        },

        onCallPrimaryPhone: function () {
            var sPhone = (this.getModel("contactDetail").getProperty("/contact/primary_phone") || "").trim();

            if (!sPhone) {
                return;
            }

            URLHelper.triggerTel(sPhone);
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
                        selectedKey: "chiamata",
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
                            user_id: this.getModel("session").getProperty("/userId") || 1,
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
