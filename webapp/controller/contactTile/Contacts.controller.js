sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/m/CheckBox",
    "sap/m/Text",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/Bar",
    "sap/m/Title",
    "sap/m/library",
    "sap/ui/core/Item",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem"
], function (
    BaseController,
    ContactApi,
    JSONModel,
    Filter,
    FilterOperator,
    Sorter,
    MessageBox,
    MessageToast,
    Dialog,
    Button,
    Label,
    Input,
    TextArea,
    Select,
    CheckBox,
    Text,
    HBox,
    VBox,
    Bar,
    Title,
    mobileLibrary,
    Item,
    ViewSettingsDialog,
    ViewSettingsItem
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

    return BaseController.extend("crm.controller.contactTile.Contacts", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
            this.setModel(new JSONModel({
                searchQuery: "",
                categoryKey: "",
                statusKey: ""
            }), "contactFilters");

            this.setModel(new JSONModel({
                contacts: [],
                selectedContactId: null,
                selectedContact: null,
                busy: false
            }), "contacts");

            this._oSortState = { path: "last_name", descending: false };
            this._loadContacts();
        },

        _loadContacts: async function () {
            var oModel = this.getModel("contacts");
            oModel.setProperty("/busy", true);

            try {
                var aContacts = await ContactApi.listContacts();
                oModel.setProperty("/contacts", aContacts || []);
                oModel.setProperty("/selectedContactId", null);
                oModel.setProperty("/selectedContact", null);
                this.byId("contactsTable").removeSelections(true);
                this._applyFiltersAndSort();
            } catch (oError) {
                // Error feedback is already handled in ContactApi
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        onFilterChange: function () {
            this._applyFiltersAndSort();
        },

        onClearFilters: function () {
            this.getModel("contactFilters").setData({
                searchQuery: "",
                categoryKey: "",
                statusKey: ""
            });
            this._applyFiltersAndSort();
        },

        _applyFiltersAndSort: function () {
            var oFilterData = this.getModel("contactFilters")?.getData() || {};
            var sQuery = (oFilterData.searchQuery || "").trim();
            var sCategory = (oFilterData.categoryKey || "").trim();
            var sStatus = (oFilterData.statusKey || "").trim();
            var oBinding = this.byId("contactsTable")?.getBinding("items");
            var aFilters = [];

            if (!oBinding) {
                return;
            }

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("first_name", FilterOperator.Contains, sQuery),
                        new Filter("last_name", FilterOperator.Contains, sQuery),
                        new Filter("email", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sCategory) {
                aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
            }

            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters, "Application");
            oBinding.sort(new Sorter(this._oSortState.path, this._oSortState.descending));
        },

        onRefreshContacts: async function () {
            await this._loadContacts();
        },

        onOpenSortDialog: function () {
            var oBundle = this.getResourceBundle();

            if (!this._oSortDialog) {
                this._oSortDialog = new ViewSettingsDialog({
                    confirm: this.onSortConfirm.bind(this),
                    sortItems: [
                        new ViewSettingsItem({ key: "last_name", text: oBundle.getText("contactsSortLastName") }),
                        new ViewSettingsItem({ key: "first_name", text: oBundle.getText("contactsSortFirstName") }),
                        new ViewSettingsItem({ key: "email", text: oBundle.getText("contactsSortEmail") }),
                        new ViewSettingsItem({ key: "category", text: oBundle.getText("contactsSortCategory") }),
                        new ViewSettingsItem({ key: "status", text: oBundle.getText("contactsSortStatus") })
                    ]
                });
                this.getView().addDependent(this._oSortDialog);
            }

            this._oSortDialog.open();
        },

        onSortConfirm: function (oEvent) {
            var oSortItem = oEvent.getParameter("sortItem");
            this._oSortState.path = (oSortItem && oSortItem.getKey()) || "last_name";
            this._oSortState.descending = !!oEvent.getParameter("sortDescending");
            this._applyFiltersAndSort();
        },

        onSelectionChange: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem && oItem.getBindingContext("contacts");
            var oData = oContext ? oContext.getObject() : null;
            var oModel = this.getModel("contacts");

            oModel.setProperty("/selectedContact", oData);
            oModel.setProperty("/selectedContactId", oData ? oData.id : null);
        },

        onOpenDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("contacts");
            var oContact = oContext && oContext.getObject();

            if (oContact && oContact.id) {
                this.navTo("contactDetail", { contactId: oContact.id });
            }
        },

        onCreateContact: function () {
            this._openContactDialog("create");
        },

        onEditContact: function () {
            var oContact = this.getModel("contacts").getProperty("/selectedContact");
            if (!oContact) {
                MessageToast.show(this.getResourceBundle().getText("contactsSelectToEdit"));
                return;
            }

            this._openContactDialog("edit", oContact);
        },

        onRowEdit: function (oEvent) {
            var oContact = oEvent.getSource().getBindingContext("contacts").getObject();
            this._openContactDialog("edit", oContact);
            oEvent.cancelBubble();
        },

        onDeleteContact: function () {
            var oContact = this.getModel("contacts").getProperty("/selectedContact");
            if (!oContact) {
                MessageToast.show(this.getResourceBundle().getText("contactsSelectToDelete"));
                return;
            }

            this._confirmDeleteContact(oContact);
        },

        onRowDelete: function (oEvent) {
            var oContact = oEvent.getSource().getBindingContext("contacts").getObject();
            this._confirmDeleteContact(oContact);
            oEvent.cancelBubble();
        },

        onCallPrimaryPhone: function (oEvent) {
            var sValue = this._getVal(oEvent);

            if (!sValue) {
                oEvent.cancelBubble();
                return;
            }

            URLHelper.triggerTel(sValue);
            oEvent.cancelBubble();
        },

        _getVal: function (oEvent) {
            return oEvent.getSource().getBindingContext("contacts").getProperty("primary_phone");
        },

        _confirmDeleteContact: function (oContact) {
            var oBundle = this.getResourceBundle();

            MessageBox.confirm(oBundle.getText("contactsDeleteConfirm", [oContact.first_name + " " + oContact.last_name]), {
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.DELETE) {
                        return;
                    }

                    try {
                        await ContactApi.deleteContact(oContact.id);
                        MessageToast.show(oBundle.getText("contactsDeleteSuccess"));
                        await this._loadContacts();
                    } catch (oError) {
                        // Error feedback is already handled in ContactApi
                    }
                }.bind(this)
            });
        },

        _createDialogModelData: async function (bEdit, oContact) {
            var oBuyerProfile = createEmptyBuyerProfile();
            var aContactPhones = [];

            if (bEdit && oContact && oContact.id) {
                aContactPhones = await ContactApi.listContactPhones(oContact.id);
                var oExistingBuyerProfile = await ContactApi.getBuyerProfileByContactId(oContact.id);
                if (oExistingBuyerProfile) {
                    var aPreferences = await ContactApi.listBuyerPreferences(oExistingBuyerProfile.id);
                    var oMappedPreferences = mapBuyerPreferences(aPreferences);

                    oBuyerProfile = Object.assign(oBuyerProfile, oExistingBuyerProfile, oMappedPreferences);
                }
            }

            return {
                contact: {
                    first_name: bEdit ? (oContact.first_name || "") : "",
                    last_name: bEdit ? (oContact.last_name || "") : "",
                    email: bEdit ? (oContact.email || "") : "",
                    pec_email: bEdit ? (oContact.pec_email || "") : "",
                    primary_phone: bEdit ? (((aContactPhones || []).find(function (oPhone) {
                        return Number(oPhone.is_primary) === 1;
                    }) || {}).phone || oContact.primary_phone || "") : "",
                    category: bEdit ? (oContact.category || "venditore") : "venditore",
                    status: bEdit ? (oContact.status || "attivo") : "attivo",
                    generic_info: bEdit ? (oContact.generic_info || "") : ""
                },
                phones: bEdit ? (aContactPhones || []).filter(function (oPhone) {
                    return Number(oPhone.is_primary) !== 1;
                }).map(function (oPhone) {
                    return { phone: oPhone.phone || "" };
                }) : [],
                buyerProfile: oBuyerProfile
            };
        },

        _createAdditionalPhonesBox: function () {
            var oBundle = this.getResourceBundle();

            return new VBox({
                width: "100%",
                items: [
                    new VBox({
                        width: "100%",
                        items: {
                            path: "contactDialog>/phones",
                            templateShareable: false,
                            template: new HBox({
                                width: "100%",
                                alignItems: "Center",
                                items: [
                                    new Input({
                                        type: "Tel",
                                        width: "100%",
                                        value: "{contactDialog>phone}",
                                        placeholder: oBundle.getText("contactsDialogPhoneAdditionalPlaceholder")
                                    }),
                                    new Button({
                                        icon: "sap-icon://less",
                                        type: "Transparent",
                                        tooltip: oBundle.getText("contactsDialogRemovePhoneButton"),
                                        press: this._onRemovePhonePress.bind(this)
                                    })
                                ]
                            }).addStyleClass("sapUiTinyMarginBottom")
                        }
                    }),
                    new Button({
                        text: oBundle.getText("contactsDialogAddPhoneButton"),
                        icon: "sap-icon://add",
                        type: "Transparent",
                        press: this._onAddPhonePress.bind(this)
                    })
                ]
            });
        },

        _buildContactDialogContent: function () {
            var oBundle = this.getResourceBundle();
            var sBuyerVisible = "{= ${contactDialog>/contact/category} === 'acquirente' }";
            var sMortgageOtherVisible = "{= ${contactDialog>/contact/category} === 'acquirente' && ${contactDialog>/buyerProfile/mortgage_type} === 'altro' }";
            var sPreferenceOtherVisible = "{= ${contactDialog>/contact/category} === 'acquirente' && ${contactDialog>/buyerProfile/preferences/altro} }";

            return [
                new Label({ text: oBundle.getText("contactsDialogFieldFirstName"), required: true }),
                new Input({ value: "{contactDialog>/contact/first_name}" }),
                new Label({ text: oBundle.getText("contactsDialogFieldLastName"), required: true }),
                new Input({ value: "{contactDialog>/contact/last_name}" }),
                new Label({ text: oBundle.getText("contactsDialogFieldEmail") }),
                new Input({ type: "Email", value: "{contactDialog>/contact/email}" }),
                new Label({ text: oBundle.getText("contactsDialogFieldPec") }),
                new Input({ type: "Email", value: "{contactDialog>/contact/pec_email}" }),
                new Label({ text: oBundle.getText("contactsDialogFieldPrimaryPhone") }),
                new Input({
                    type: "Tel",
                    value: "{contactDialog>/contact/primary_phone}",
                    placeholder: oBundle.getText("contactsDialogPhonePrimaryPlaceholder")
                }),
                new Label({ text: oBundle.getText("contactsDialogFieldAdditionalPhones") }),
                this._createAdditionalPhonesBox(),
                new Label({ text: oBundle.getText("contactsDialogFieldCategory") }),
                new Select({
                    selectedKey: "{contactDialog>/contact/category}",
                    width: "100%",
                    items: {
                        path: "categoriesContact>/",
                        templateShareable: false,
                        template: new Item({ key: "{categoriesContact>key}", text: "{categoriesContact>value}" })
                    }
                }),
                new Label({ text: oBundle.getText("contactsDialogFieldStatus") }),
                new Select({
                    selectedKey: "{contactDialog>/contact/status}",
                    width: "100%",
                    items: {
                        path: "statesContact>/",
                        templateShareable: false,
                        template: new Item({ key: "{statesContact>key}", text: "{statesContact>value}" })
                    }
                }),
                new Label({ text: oBundle.getText("contactsDialogFieldGenericInfo") }),
                new TextArea({ width: "100%", rows: 4, value: "{contactDialog>/contact/generic_info}" }),
                new Label({ text: oBundle.getText("contactsDialogFieldRequestedArea"), visible: sBuyerVisible }),
                new Input({ value: "{contactDialog>/buyerProfile/requested_area}", visible: sBuyerVisible }),
                new Label({ text: oBundle.getText("contactsDialogFieldPropertyType"), visible: sBuyerVisible }),
                new Input({ value: "{contactDialog>/buyerProfile/property_type}", visible: sBuyerVisible }),
                new Label({ text: oBundle.getText("contactsDialogFieldFloorPreference"), visible: sBuyerVisible }),
                new Select({
                    selectedKey: "{contactDialog>/buyerProfile/floor_preference}",
                    width: "100%",
                    visible: sBuyerVisible,
                    items: {
                        path: "favoriteFloor>/",
                        templateShareable: false,
                        template: new Item({ key: "{favoriteFloor>key}", text: "{favoriteFloor>value}" })
                    }
                }),
                new Label({ text: oBundle.getText("contactsDialogFieldBudgetRenovated"), visible: sBuyerVisible }),
                new Input({ type: "Number", value: "{contactDialog>/buyerProfile/purchase_price_renovated}", visible: sBuyerVisible }),
                new Label({ text: oBundle.getText("contactsDialogFieldBudgetToRenovate"), visible: sBuyerVisible }),
                new Input({ type: "Number", value: "{contactDialog>/buyerProfile/purchase_price_to_renovate}", visible: sBuyerVisible }),
                new Label({ text: oBundle.getText("contactsDialogFieldMortgage"), visible: sBuyerVisible }),
                new Select({
                    selectedKey: "{contactDialog>/buyerProfile/mortgage_type}",
                    width: "100%",
                    visible: sBuyerVisible,
                    items: {
                        path: "valueMutuo>/",
                        templateShareable: false,
                        template: new Item({ key: "{valueMutuo>key}", text: "{valueMutuo>value}" })
                    }
                }),
                new Label({ text: oBundle.getText("contactsDialogFieldMortgageDetail"), visible: sMortgageOtherVisible }),
                new TextArea({ rows: 3, value: "{contactDialog>/buyerProfile/mortgage_other}", visible: sMortgageOtherVisible }),
                new Label({ text: oBundle.getText("contactsDialogFieldPreferences"), visible: sBuyerVisible }),
                new CheckBox({ text: oBundle.getText("contactsDialogPreferenceBox"), selected: "{contactDialog>/buyerProfile/preferences/box}", visible: sBuyerVisible }),
                new Label({ text: "", visible: sBuyerVisible }),
                new CheckBox({ text: oBundle.getText("contactsDialogPreferenceParking"), selected: "{contactDialog>/buyerProfile/preferences/posto_auto}", visible: sBuyerVisible }),
                new Label({ text: "", visible: sBuyerVisible }),
                new CheckBox({ text: oBundle.getText("contactsDialogPreferenceCellar"), selected: "{contactDialog>/buyerProfile/preferences/cantina}", visible: sBuyerVisible }),
                new Label({ text: "", visible: sBuyerVisible }),
                new CheckBox({ text: oBundle.getText("contactsDialogPreferenceTerrace"), selected: "{contactDialog>/buyerProfile/preferences/terrazzo}", visible: sBuyerVisible }),
                new Label({ text: "", visible: sBuyerVisible }),
                new CheckBox({ text: oBundle.getText("contactsDialogPreferenceOther"), selected: "{contactDialog>/buyerProfile/preferences/altro}", visible: sBuyerVisible }),
                new Label({ text: oBundle.getText("contactsDialogFieldPreferenceOther"), visible: sPreferenceOtherVisible }),
                new Input({ value: "{contactDialog>/buyerProfile/preference_other}", visible: sPreferenceOtherVisible })
            ];
        },

        _onAddPhonePress: function (oEvent) {
            var oModel = oEvent.getSource().getModel("contactDialog");
            var aPhones = oModel.getProperty("/phones") || [];

            aPhones.push(createEmptyAdditionalPhone());
            oModel.setProperty("/phones", aPhones);
        },

        _onRemovePhonePress: function (oEvent) {
            var oModel = oEvent.getSource().getModel("contactDialog");
            var oContext = oEvent.getSource().getBindingContext("contactDialog");
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

        _saveContactPhones: async function (iContactId, oDialogData) {
            var aPhones = normalizePhoneList(
                oDialogData.contact && oDialogData.contact.primary_phone,
                oDialogData.phones
            );

            await ContactApi.replaceContactPhones(iContactId, aPhones);
        },

        _saveBuyerProfileData: async function (iContactId, oDialogData) {
            var oBuyerProfile = oDialogData.buyerProfile || createEmptyBuyerProfile();
            var oContact = oDialogData.contact || {};
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

        _setPendingPostCreateAction: function (iContactId, sAction) {
            this.getOwnerComponent()._oPendingContactAction = {
                contactId: iContactId,
                action: sAction
            };
        },

        _clearPendingPostCreateAction: function () {
            this.getOwnerComponent()._oPendingContactAction = null;
        },

        _buildDialogHeader: function (sTitle, fnOnClose) {
            var oBundle = this.getResourceBundle();

            return new Bar({
                contentMiddle: [
                    new Title({ text: sTitle })
                ],
                contentRight: [
                    new Button({
                        icon: "sap-icon://decline",
                        type: "Transparent",
                        tooltip: oBundle.getText("contactsDialogCloseTooltip"),
                        press: fnOnClose
                    })
                ]
            });
        },

        _openPostCreateActionDialog: function (oContact) {
            var oBundle = this.getResourceBundle();
            var bActionSelected = false;
            var oDialog = new Dialog({
                type: "Message",
                contentWidth: "28rem",
                customHeader: this._buildDialogHeader(
                    oBundle.getText("contactsPostCreateActionTitle"),
                    function () {
                        oDialog.close();
                    }
                ),
                content: [
                    new Text({
                        text: oBundle.getText("contactsPostCreateActionText"),
                        wrapping: true
                    })
                ],
                buttons: [
                    new Button({
                        text: oBundle.getText("contactsPostCreateNoteButton"),
                        type: "Emphasized",
                        press: function () {
                            bActionSelected = true;
                            this._setPendingPostCreateAction(oContact.id, "note");
                            oDialog.close();
                            this.navTo("contactDetail", { contactId: oContact.id });
                        }.bind(this)
                    }),
                    new Button({
                        text: oBundle.getText("contactsPostCreateActivityButton"),
                        press: function () {
                            bActionSelected = true;
                            this._setPendingPostCreateAction(oContact.id, "activity");
                            oDialog.close();
                            this.navTo("contactDetail", { contactId: oContact.id });
                        }.bind(this)
                    }),
                    new Button({
                        text: oBundle.getText("contactsDialogCloseButton"),
                        press: function () {
                            oDialog.close();
                        }
                    })
                ],
                afterClose: async function () {
                    oDialog.destroy();

                    if (!bActionSelected) {
                        this._clearPendingPostCreateAction();
                        await this._loadContacts();
                    }
                }.bind(this)
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        _openPostCreatePrompt: function (oContact) {
            var oBundle = this.getResourceBundle();
            var bConfirmed = false;
            var oDialog = new Dialog({
                type: "Message",
                contentWidth: "30rem",
                customHeader: this._buildDialogHeader(
                    oBundle.getText("contactsPostCreatePromptTitle"),
                    function () {
                        oDialog.close();
                    }
                ),
                content: [
                    new Text({
                        text: oBundle.getText("contactsPostCreatePromptText"),
                        wrapping: true
                    })
                ],
                buttons: [
                    new Button({
                        text: oBundle.getText("contactsPostCreatePromptYes"),
                        type: "Emphasized",
                        press: function () {
                            bConfirmed = true;
                            oDialog.close();
                            this._openPostCreateActionDialog(oContact);
                        }.bind(this)
                    }),
                    new Button({
                        text: oBundle.getText("contactsPostCreatePromptNo"),
                        press: function () {
                            oDialog.close();
                        }
                    })
                ],
                afterClose: async function () {
                    oDialog.destroy();

                    if (!bConfirmed) {
                        this._clearPendingPostCreateAction();
                        await this._loadContacts();
                    }
                }.bind(this)
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        _openContactDialog: async function (sMode, oContact) {
            var bEdit = sMode === "edit";
            var oBundle = this.getResourceBundle();
            var oDialogModelData;

            try {
                oDialogModelData = await this._createDialogModelData(bEdit, oContact);
            } catch (oError) {
                return;
            }

            var oDialog = new Dialog({
                title: bEdit ? oBundle.getText("contactsDialogEditTitle") : oBundle.getText("contactsDialogCreateTitle"),
                contentWidth: "42rem",
                resizable: true,
                type: "Message",
                content: this._buildContactDialogContent(),
                beginButton: new Button({
                    text: oBundle.getText("contactsDialogSaveButton"),
                    type: "Emphasized",
                    press: async function () {
                        var oDialogData = oDialog.getModel("contactDialog").getData();
                        var oPayload = {
                            first_name: (oDialogData.contact.first_name || "").trim(),
                            last_name: (oDialogData.contact.last_name || "").trim(),
                            email: (oDialogData.contact.email || "").trim(),
                            pec_email: (oDialogData.contact.pec_email || "").trim(),
                            category: oDialogData.contact.category,
                            status: oDialogData.contact.status,
                            generic_info: oDialogData.contact.generic_info || ""
                        };
                        var iUserId = this.getModel("session").getProperty("/userId") || 1;
                        var oSavedContact;

                        if (!oPayload.first_name || !oPayload.last_name) {
                            MessageToast.show(oBundle.getText("contactsValidationNameRequired"));
                            return;
                        }

                        try {
                            if (bEdit) {
                                oSavedContact = await ContactApi.updateContact(oContact.id, oPayload);
                            } else {
                                oSavedContact = await ContactApi.createContact(Object.assign({ user_id: iUserId }, oPayload));
                            }

                            await this._saveContactPhones(oSavedContact.id, oDialogData);
                            await this._saveBuyerProfileData(oSavedContact.id, oDialogData);

                            MessageToast.show(oBundle.getText(bEdit ? "contactsUpdateSuccess" : "contactsCreateSuccess"));
                            oDialog.close();
                            await this._loadContacts();

                            if (!bEdit) {
                                this._openPostCreatePrompt(oSavedContact);
                            }
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

            oDialog.setModel(new JSONModel(oDialogModelData), "contactDialog");
            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
