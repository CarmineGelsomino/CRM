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
    "sap/m/DateTimePicker",
    "sap/m/library",
    "sap/ui/core/ListItem",
    "sap/ui/core/Item"
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
    DateTimePicker,
    mobileLibrary,
    ListItem,
    Item
) {
    "use strict";

    var URLHelper = mobileLibrary.URLHelper;

    function createEmptyProperty() {
        return {
            property_type: "",
            address_line: "",
            city: "",
            postal_code: "",
            province: "",
            country: "Italia",
            subalterno: "",
            apartment_floor: "",
            internal_sqm: "",
            external_sqm: "",
            other_info: "",
            description: "",
            property_condition: "",
            listing_url: "",
            owner_home_address: "",
            work_contact: "",
            first_av: "",
            administrator: ""
        };
    }

    function createEmptyOwner() {
        return {
            contact_id: null,
            display_value: "",
            primary_phone: "",
            category: "",
            status: ""
        };
    }

    function normalizeSearchValue(sValue) {
        return (sValue || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function buildContactDisplay(oContact) {
        return ((oContact.first_name || "") + " " + (oContact.last_name || "")).trim();
    }

    function buildPropertyHeader(oProperty) {
        var sAddress = (oProperty.address_line || "").trim();
        var sSubalterno = (oProperty.subalterno || "").trim();
        return sSubalterno ? sAddress + " - Sub. " + sSubalterno : sAddress;
    }

    function mapOwnerForSave(oOwner, iIndex) {
        return {
            contact_id: oOwner.contact_id,
            is_primary_owner: iIndex === 0 ? 1 : 0
        };
    }

    function formatDateTimeForApi(oDate) {
        if (!(oDate instanceof Date) || Number.isNaN(oDate.getTime())) {
            return null;
        }

        function pad(iValue) {
            return String(iValue).padStart(2, "0");
        }

        return oDate.getFullYear() +
            "-" + pad(oDate.getMonth() + 1) +
            "-" + pad(oDate.getDate()) +
            " " + pad(oDate.getHours()) +
            ":" + pad(oDate.getMinutes()) +
            ":" + pad(oDate.getSeconds());
    }

    function parseActivityDate(sValue) {
        if (!sValue) {
            return null;
        }

        var oDate = new Date(String(sValue).replace(" ", "T"));
        return Number.isNaN(oDate.getTime()) ? null : oDate;
    }

    return BaseController.extend("crm.controller.propertyTile.DetailProperty", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
            this.setModel(new JSONModel({
                propertyId: null,
                property: createEmptyProperty(),
                linkedContacts: [createEmptyOwner()],
                activities: [],
                notes: []
            }), "propertyDetail");

            this._aContactCache = null;
            this.getRouter().getRoute("propertyDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var iPropertyId = Number(oEvent.getParameter("arguments").propertyId);
            this.getModel("propertyDetail").setProperty("/propertyId", iPropertyId);
            this._loadProperty(iPropertyId);
        },

        _ensureContactCache: async function () {
            if (!this._aContactCache) {
                this._aContactCache = await ContactApi.listContacts();
            }

            return this._aContactCache || [];
        },

        _loadProperty: async function (iPropertyId) {
            try {
                var oProperty = await ContactApi.getProperty(iPropertyId);
                var aLinkedContacts = await this._loadOwners(iPropertyId);
                var aCollections = await this._loadAggregatedCollections(aLinkedContacts);
                var oModel = this.getModel("propertyDetail");

                oModel.setProperty("/property", Object.assign(createEmptyProperty(), oProperty || {}));
                oModel.setProperty("/linkedContacts", aLinkedContacts.length ? aLinkedContacts : [createEmptyOwner()]);
                oModel.setProperty("/activities", aCollections.activities);
                oModel.setProperty("/notes", aCollections.notes);
            } catch (oError) {
                // handled by API
            }
        },

        _loadOwners: async function (iPropertyId) {
            var aOwnerLinks = await ContactApi.listPropertyOwners({ property_id: iPropertyId });

            if (!aOwnerLinks || !aOwnerLinks.length) {
                return [];
            }

            var aContacts = await this._ensureContactCache();
            var mContactsById = (aContacts || []).reduce(function (mMap, oContact) {
                mMap[oContact.id] = oContact;
                return mMap;
            }, {});

            return aOwnerLinks.map(function (oOwner) {
                var oContact = mContactsById[oOwner.contact_id] || {};
                return {
                    contact_id: oOwner.contact_id,
                    display_value: buildContactDisplay(oContact),
                    primary_phone: oContact.primary_phone || "",
                    category: oContact.category || "",
                    status: oContact.status || ""
                };
            });
        },

        _loadAggregatedCollections: async function (aLinkedContacts) {
            var aContacts = await this._ensureContactCache();
            var mContactsById = (aContacts || []).reduce(function (mMap, oContact) {
                mMap[oContact.id] = oContact;
                return mMap;
            }, {});
            var aOwnerIds = Array.from(new Set((aLinkedContacts || []).map(function (oOwner) {
                return oOwner.contact_id;
            }).filter(Boolean)));
            var aActivities = [];
            var aNotes = [];

            await Promise.all(aOwnerIds.map(async function (iContactId) {
                var sContactName = buildContactDisplay(mContactsById[iContactId] || {});
                var aContactActivities = await ContactApi.listActivities(iContactId);
                var aContactNotes = await ContactApi.listNotes(iContactId);

                aActivities = aActivities.concat((aContactActivities || []).map(function (oActivity) {
                    return Object.assign({}, oActivity, {
                        contact_name: sContactName,
                        contact_id: iContactId
                    });
                }));

                aNotes = aNotes.concat((aContactNotes || []).map(function (oNote) {
                    return Object.assign({}, oNote, {
                        contact_name: sContactName,
                        contact_id: iContactId
                    });
                }));
            }));

            aActivities.sort(function (oLeft, oRight) {
                return new Date(oRight.reminder_at || 0).getTime() - new Date(oLeft.reminder_at || 0).getTime();
            });
            aNotes.sort(function (oLeft, oRight) {
                return new Date(oRight.created_at || 0).getTime() - new Date(oLeft.created_at || 0).getTime();
            });

            return {
                activities: aActivities,
                notes: aNotes
            };
        },

        onSaveProperty: async function () {
            var oBundle = this.getResourceBundle();
            var oModel = this.getModel("propertyDetail");
            var iPropertyId = oModel.getProperty("/propertyId");
            var oProperty = oModel.getProperty("/property");
            var aLinkedContacts = oModel.getProperty("/linkedContacts") || [];

            if (!(oProperty.address_line || "").trim() || !(oProperty.city || "").trim()) {
                MessageToast.show(oBundle.getText("propertiesValidationAddressRequired"));
                return;
            }

            if (!this._validateLinkedContacts(aLinkedContacts)) {
                return;
            }

            try {
                await ContactApi.updateProperty(iPropertyId, oProperty);
                await ContactApi.replacePropertyContacts(iPropertyId, this._normalizeLinkedContactsForSave(aLinkedContacts));
                MessageToast.show(oBundle.getText("propertiesUpdateSuccess"));
                await this._loadProperty(iPropertyId);
            } catch (oError) {
                // handled by API
            }
        },

        _normalizeLinkedContactsForSave: function (aLinkedContacts) {
            return (aLinkedContacts || []).filter(function (oLinkedContact) {
                return (oLinkedContact.display_value || "").trim();
            }).map(mapOwnerForSave);
        },

        _validateLinkedContacts: function (aLinkedContacts) {
            if (this._normalizeLinkedContactsForSave(aLinkedContacts).some(function (oOwner) {
                return !oOwner.contact_id;
            })) {
                MessageToast.show(this.getResourceBundle().getText("propertyDetailOwnerValidation"));
                return false;
            }

            return true;
        },

        onAddOwner: function () {
            var aLinkedContacts = this.getModel("propertyDetail").getProperty("/linkedContacts") || [];
            aLinkedContacts.push(createEmptyOwner());
            this.getModel("propertyDetail").setProperty("/linkedContacts", aLinkedContacts);
        },

        onRemoveOwner: function (oEvent) {
            var oModel = this.getModel("propertyDetail");
            var sPath = oEvent.getSource().getBindingContext("propertyDetail").getPath();
            var aLinkedContacts = oModel.getProperty("/linkedContacts") || [];
            var iIndex = Number(sPath.split("/").pop());

            if (Number.isNaN(iIndex)) {
                return;
            }

            aLinkedContacts.splice(iIndex, 1);
            oModel.setProperty("/linkedContacts", aLinkedContacts.length ? aLinkedContacts : [createEmptyOwner()]);
        },

        onOwnerLiveChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var oModel = oInput.getModel("propertyDetail");
            var sPath = oInput.getBindingContext("propertyDetail").getPath();

            oModel.setProperty(sPath + "/display_value", oEvent.getParameter("value"));
            oModel.setProperty(sPath + "/contact_id", null);
            oModel.setProperty(sPath + "/primary_phone", "");
            oModel.setProperty(sPath + "/category", "");
            oModel.setProperty(sPath + "/status", "");
        },

        onSuggestOwner: async function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = normalizeSearchValue(oEvent.getParameter("suggestValue"));
            var aContacts = await this._ensureContactCache();
            var aMatches;

            if (sValue.length < 2) {
                oInput.destroySuggestionItems();
                return;
            }

            aMatches = (aContacts || []).filter(function (oContact) {
                var sLabel = normalizeSearchValue(buildContactDisplay(oContact));
                var sEmail = normalizeSearchValue(oContact.email || "");
                return sLabel.indexOf(sValue) !== -1 || sEmail.indexOf(sValue) !== -1;
            }).slice(0, 10);

            oInput.destroySuggestionItems();
            aMatches.forEach(function (oContact) {
                oInput.addSuggestionItem(new ListItem({
                    key: String(oContact.id),
                    text: buildContactDisplay(oContact),
                    additionalText: oContact.email || ""
                }));
            });
        },

        onOwnerSelected: async function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) {
                return;
            }

            var oInput = oEvent.getSource();
            var oModel = oInput.getModel("propertyDetail");
            var sPath = oInput.getBindingContext("propertyDetail").getPath();
            var iContactId = Number(oSelectedItem.getKey());
            var aContacts = await this._ensureContactCache();
            var oContact = (aContacts || []).find(function (oCurrentContact) {
                return oCurrentContact.id === iContactId;
            }) || {};

            oModel.setProperty(sPath, {
                contact_id: iContactId,
                display_value: oSelectedItem.getText(),
                primary_phone: oContact.primary_phone || "",
                category: oContact.category || "",
                status: oContact.status || ""
            });
        },

        onOpenLinkedContact: function (oEvent) {
            var oOwner = oEvent.getSource().getBindingContext("propertyDetail").getObject();

            if (oOwner.contact_id) {
                this.navTo("contactDetail", { contactId: oOwner.contact_id });
            }
        },

        onCallOwner: function (oEvent) {
            var oOwner = oEvent.getSource().getBindingContext("propertyDetail").getObject();

            if (oOwner.primary_phone) {
                URLHelper.triggerTel(oOwner.primary_phone);
            }
        },

        onFilterActivities: function (oEvent) {
            var oSource = oEvent.getSource();
            var sQuery = oSource.isA("sap.m.SearchField")
                ? (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim()
                : (this.byId("propertyActivitySearchField").getValue() || "").trim();
            var sStatus = this.byId("propertyActivityStatusFilter").getSelectedKey();
            var aFilters = [];
            var oBinding = this.byId("propertyActivitiesList").getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("title", FilterOperator.Contains, sQuery),
                        new Filter("description", FilterOperator.Contains, sQuery),
                        new Filter("contact_name", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters, "Application");
        },

        onFilterNotes: function (oEvent) {
            var sQuery = (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim();
            var aFilters = sQuery ? [new Filter({
                filters: [
                    new Filter("message", FilterOperator.Contains, sQuery),
                    new Filter("contact_name", FilterOperator.Contains, sQuery)
                ],
                and: false
            })] : [];
            var oBinding = this.byId("propertyNotesList").getBinding("items");

            if (!oBinding) {
                return;
            }

            oBinding.filter(aFilters, "Application");
        },

        _getOwnerTargetsForNewEntry: function () {
            return this._normalizeLinkedContactsForSave(this.getModel("propertyDetail").getProperty("/linkedContacts") || []);
        },

        _buildOwnerItems: function (aTargets) {
            var aOwners = this.getModel("propertyDetail").getProperty("/linkedContacts") || [];

            return aTargets.map(function (oTarget) {
                var oOwner = aOwners.find(function (oCurrentOwner) {
                    return String(oCurrentOwner.contact_id) === String(oTarget.contact_id);
                }) || {};

                return new Item({
                    key: String(oTarget.contact_id),
                    text: oOwner.display_value || String(oTarget.contact_id)
                });
            });
        },

        _getDefaultActivityStatusKey: function () {
            var aActivityStates = this.getOwnerComponent().getModel("activityStates").getData() || [];
            var oDefaultState = aActivityStates.find(function (oState) {
                return oState.isDefault;
            });

            return (oDefaultState && oDefaultState.key) || "";
        },

        _getEditableActivityStates: function () {
            return (this.getOwnerComponent().getModel("activityStates").getData() || []).filter(function (oState) {
                return !oState.isFilterOnly;
            });
        },

        _buildActivityPayloadFromDialog: function (mIds, bIsEdit) {
            var sStatus = sap.ui.getCore().byId(mIds.status).getSelectedKey();

            return {
                user_id: this.getModel("session").getProperty("/userId") || 1,
                contact_id: Number(sap.ui.getCore().byId(mIds.contact).getSelectedKey()),
                title: sap.ui.getCore().byId(mIds.title).getValue().trim(),
                activity_type: sap.ui.getCore().byId(mIds.type).getSelectedKey(),
                description: sap.ui.getCore().byId(mIds.description).getValue(),
                reminder_at: formatDateTimeForApi(sap.ui.getCore().byId(mIds.reminder).getDateValue()),
                priority: sap.ui.getCore().byId(mIds.priority).getSelectedKey(),
                status: sStatus,
                completed_at: sStatus === "completato" ? formatDateTimeForApi(new Date()) : (bIsEdit ? null : undefined)
            };
        },

        onSectionTabSelect: function (oEvent) {
            this._scrollToSection(oEvent.getParameter("key"));
        },

        _scrollToSection: function (sSectionId) {
            var oSection = this.byId(sSectionId);
            var oDomRef = oSection && oSection.getDomRef();

            if (oDomRef) {
                oDomRef.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        },

        _openActivityDialog: function (oOptions) {
            var oBundle = this.getResourceBundle();
            var aTargets = this._getOwnerTargetsForNewEntry();
            var aActivityTypes = this.getOwnerComponent().getModel("activityTypes").getData() || [];
            var aActivityStates = this._getEditableActivityStates();
            var oActivity = oOptions.activity || {};
            var mIds = {
                contact: oOptions.idPrefix + "Contact",
                title: oOptions.idPrefix + "Title",
                type: oOptions.idPrefix + "Type",
                description: oOptions.idPrefix + "Description",
                reminder: oOptions.idPrefix + "Reminder",
                priority: oOptions.idPrefix + "Priority",
                status: oOptions.idPrefix + "Status"
            };
            var oDialog;

            if (!aTargets.length) {
                MessageToast.show(oBundle.getText("propertyDetailNoOwnersForAggregation"));
                return;
            }

            oDialog = new Dialog({
                title: oOptions.title,
                contentWidth: "30rem",
                type: "Message",
                content: [
                    new Label({ text: oBundle.getText("propertyDetailLinkedContactPrefix") }),
                    new Select(mIds.contact, {
                        width: "100%",
                        selectedKey: String(oActivity.contact_id || oOptions.defaultContactId || ""),
                        items: this._buildOwnerItems(aTargets)
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldTitle"), required: true }),
                    new Input(mIds.title, { value: oActivity.title || "" }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldType") }),
                    new Select(mIds.type, {
                        width: "100%",
                        selectedKey: oActivity.activity_type || "chiamata",
                        items: aActivityTypes.map(function (oType) {
                            return new Item({
                                key: oType.key,
                                text: oBundle.getText(oType.i18n)
                            });
                        })
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldDescription") }),
                    new TextArea(mIds.description, { rows: 4, value: oActivity.description || "" }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldReminder") }),
                    new DateTimePicker(mIds.reminder, { dateValue: parseActivityDate(oActivity.reminder_at) }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldPriority") }),
                    new Select(mIds.priority, {
                        selectedKey: oActivity.priority || "media",
                        items: [
                            new Item({ key: "bassa", text: oBundle.getText("contactDetailPriorityLow") }),
                            new Item({ key: "media", text: oBundle.getText("contactDetailPriorityMedium") }),
                            new Item({ key: "alta", text: oBundle.getText("contactDetailPriorityHigh") })
                        ]
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldStatus") }),
                    new Select(mIds.status, {
                        width: "100%",
                        selectedKey: oActivity.status || this._getDefaultActivityStatusKey(),
                        items: aActivityStates.map(function (oState) {
                            return new Item({ key: oState.key, text: oState.value });
                        })
                    })
                ],
                beginButton: new Button({
                    text: oOptions.confirmText,
                    type: "Emphasized",
                    press: async function () {
                        var oPayload = this._buildActivityPayloadFromDialog(mIds, !!oOptions.activity);

                        if (!oPayload.title) {
                            MessageToast.show(oBundle.getText("contactDetailActivityTitleRequired"));
                            return;
                        }

                        try {
                            await oOptions.onConfirm(oPayload);
                            MessageToast.show(oOptions.successMessage);
                            oDialog.close();
                        } catch (oError) {
                            // handled by API
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

        onAddActivity: function () {
            var aTargets = this._getOwnerTargetsForNewEntry();
            this._openActivityDialog({
                idPrefix: "newPropertyActivity",
                defaultContactId: aTargets[0] ? String(aTargets[0].contact_id) : "",
                title: this.getResourceBundle().getText("contactDetailNewActivityTitle"),
                confirmText: this.getResourceBundle().getText("contactDetailAddButton"),
                successMessage: this.getResourceBundle().getText("contactDetailActivityAdded"),
                onConfirm: async function (oPayload) {
                    await ContactApi.createActivity(oPayload);
                    await this._loadProperty(this.getModel("propertyDetail").getProperty("/propertyId"));
                }.bind(this)
            });
        },

        onEditActivity: function (oEvent) {
            var oActivity = oEvent.getSource().getBindingContext("propertyDetail").getObject();

            if (!oActivity || !oActivity.id) {
                return;
            }

            this._openActivityDialog({
                idPrefix: "editPropertyActivity",
                activity: oActivity,
                title: this.getResourceBundle().getText("contactDetailEditActivityTitle"),
                confirmText: this.getResourceBundle().getText("contactDetailSaveActivityButton"),
                successMessage: this.getResourceBundle().getText("contactDetailActivityUpdated"),
                onConfirm: async function (oPayload) {
                    await ContactApi.updateActivity(oActivity.id, oPayload);
                    await this._loadProperty(this.getModel("propertyDetail").getProperty("/propertyId"));
                }.bind(this)
            });
        },

        onAddNote: function () {
            this._openContactBoundDialog("note");
        },

        _openContactBoundDialog: function (sMode) {
            var oBundle = this.getResourceBundle();
            var aTargets = this._getOwnerTargetsForNewEntry();
            var aActivityTypes = this.getOwnerComponent().getModel("activityTypes").getData() || [];
            var sDefaultContactId = aTargets[0] ? String(aTargets[0].contact_id) : "";
            var oDialog;

            if (!aTargets.length) {
                MessageToast.show(oBundle.getText("propertyDetailNoOwnersForAggregation"));
                return;
            }

            if (sMode === "activity") {
                oDialog = new Dialog({
                    title: oBundle.getText("contactDetailNewActivityTitle"),
                    contentWidth: "30rem",
                    type: "Message",
                    content: [
                        new Label({ text: oBundle.getText("propertyDetailLinkedContactPrefix") }),
                        new Select("newPropertyActivityContact", {
                            width: "100%",
                            selectedKey: sDefaultContactId,
                            items: this._buildOwnerItems(aTargets)
                        }),
                        new Label({ text: oBundle.getText("contactDetailActivityFieldTitle"), required: true }),
                        new Input("newPropertyActivityTitle"),
                        new Label({ text: oBundle.getText("contactDetailActivityFieldType") }),
                        new Select("newPropertyActivityType", {
                            width: "100%",
                            selectedKey: "chiamata",
                            items: aActivityTypes.map(function (oType) {
                                return new Item({
                                    key: oType.key,
                                    text: oBundle.getText(oType.i18n)
                                });
                            })
                        }),
                        new Label({ text: oBundle.getText("contactDetailActivityFieldDescription") }),
                        new TextArea("newPropertyActivityDescription", { rows: 4 }),
                        new Label({ text: oBundle.getText("contactDetailActivityFieldReminder") }),
                        new DateTimePicker("newPropertyActivityReminder"),
                        new Label({ text: oBundle.getText("contactDetailActivityFieldPriority") }),
                        new Select("newPropertyActivityPriority", {
                            selectedKey: "media",
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
                            var sTitle = sap.ui.getCore().byId("newPropertyActivityTitle").getValue().trim();
                            var oReminderDate = sap.ui.getCore().byId("newPropertyActivityReminder").getDateValue();

                            if (!sTitle) {
                                MessageToast.show(oBundle.getText("contactDetailActivityTitleRequired"));
                                return;
                            }

                            try {
                                await ContactApi.createActivity({
                                    user_id: this.getModel("session").getProperty("/userId") || 1,
                                    contact_id: Number(sap.ui.getCore().byId("newPropertyActivityContact").getSelectedKey()),
                                    title: sTitle,
                                    activity_type: sap.ui.getCore().byId("newPropertyActivityType").getSelectedKey(),
                                    description: sap.ui.getCore().byId("newPropertyActivityDescription").getValue(),
                                    reminder_at: formatDateTimeForApi(oReminderDate),
                                    priority: sap.ui.getCore().byId("newPropertyActivityPriority").getSelectedKey(),
                                    status: this._getDefaultActivityStatusKey()
                                });
                                MessageToast.show(oBundle.getText("contactDetailActivityAdded"));
                                oDialog.close();
                                await this._loadProperty(this.getModel("propertyDetail").getProperty("/propertyId"));
                            } catch (oError) {
                                // handled by API
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
            } else {
                oDialog = new Dialog({
                    title: oBundle.getText("contactDetailNewNoteTitle"),
                    contentWidth: "28rem",
                    type: "Message",
                    content: [
                        new Label({ text: oBundle.getText("propertyDetailLinkedContactPrefix") }),
                        new Select("newPropertyNoteContact", {
                            width: "100%",
                            selectedKey: sDefaultContactId,
                            items: this._buildOwnerItems(aTargets)
                        }),
                        new Label({ text: oBundle.getText("contactDetailNoteFieldText"), required: true }),
                        new TextArea("newPropertyNoteMessage", { rows: 6 })
                    ],
                    beginButton: new Button({
                        text: oBundle.getText("contactDetailAddButton"),
                        type: "Emphasized",
                        press: async function () {
                            var sMessage = sap.ui.getCore().byId("newPropertyNoteMessage").getValue().trim();

                            if (!sMessage) {
                                MessageToast.show(oBundle.getText("contactDetailNoteTextRequired"));
                                return;
                            }

                            try {
                                await ContactApi.createNote({
                                    user_id: this.getModel("session").getProperty("/userId") || 1,
                                    contact_id: Number(sap.ui.getCore().byId("newPropertyNoteContact").getSelectedKey()),
                                    message: sMessage
                                });
                                MessageToast.show(oBundle.getText("contactDetailNoteAdded"));
                                oDialog.close();
                                await this._loadProperty(this.getModel("propertyDetail").getProperty("/propertyId"));
                            } catch (oError) {
                                // handled by API
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
            }

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onOpenListingUrl: function () {
            var sUrl = (this.getModel("propertyDetail").getProperty("/property/listing_url") || "").trim();

            if (sUrl) {
                URLHelper.redirect(sUrl, true);
            }
        },

        onOpenActivityContact: function (oEvent) {
            var oActivity = oEvent.getSource().getBindingContext("propertyDetail").getObject();

            if (oActivity.contact_id) {
                this.navTo("contactDetail", { contactId: oActivity.contact_id });
            }
        },

        onOpenNoteContact: function (oEvent) {
            var oNote = oEvent.getSource().getBindingContext("propertyDetail").getObject();

            if (oNote.contact_id) {
                this.navTo("contactDetail", { contactId: oNote.contact_id });
            }
        },

        buildPropertyHeader: buildPropertyHeader
    });
});
