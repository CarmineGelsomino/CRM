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
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/ObjectStatus",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/ui/core/Item",
    "sap/ui/core/ListItem"
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
    VBox,
    HBox,
    ObjectStatus,
    SimpleForm,
    ViewSettingsDialog,
    ViewSettingsItem,
    Item,
    ListItem
) {
    "use strict";

    function formatPropertyLabel(oProperty) {
        var sAddress = (oProperty.address_line || "").trim();
        var sSubalterno = (oProperty.subalterno || "").trim();
        return sSubalterno ? sAddress + " - Sub. " + sSubalterno : sAddress;
    }

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

    return BaseController.extend("crm.controller.propertyTile.Property", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");
            this.setModel(new JSONModel({
                searchQuery: "",
                conditionKey: ""
            }), "propertyFilters");
            this.setModel(new JSONModel({
                properties: [],
                selectedPropertyId: null,
                selectedProperty: null,
                busy: false
            }), "properties");

            this._aContactCache = null;
            this._oSortState = { path: "address_line", descending: false };
            this._loadProperties();
        },

        _ensureContactCache: async function () {
            if (!this._aContactCache) {
                this._aContactCache = await ContactApi.listContacts();
            }

            return this._aContactCache || [];
        },

        _loadProperties: async function () {
            var oModel = this.getModel("properties");
            oModel.setProperty("/busy", true);

            try {
                var aProperties = await ContactApi.listProperties();
                var aOwners = await ContactApi.listPropertyOwners();
                var aContacts = await ContactApi.listContacts();
                var mContactsById = (aContacts || []).reduce(function (mMap, oContact) {
                    mMap[oContact.id] = oContact;
                    return mMap;
                }, {});
                var mOwnersByPropertyId = (aOwners || []).reduce(function (mMap, oOwner) {
                    var oContact = mContactsById[oOwner.contact_id];
                    var sName = oContact ? ((oContact.first_name || "") + " " + (oContact.last_name || "")).trim() : "";

                    if (!mMap[oOwner.property_id]) {
                        mMap[oOwner.property_id] = [];
                    }

                    if (sName) {
                        mMap[oOwner.property_id].push(sName);
                    }

                    return mMap;
                }, {});

                oModel.setProperty("/properties", (aProperties || []).map(function (oProperty) {
                    var aOwnerNames = mOwnersByPropertyId[oProperty.id] || [];
                    return Object.assign({}, oProperty, {
                        property_label: formatPropertyLabel(oProperty),
                        owner_names: aOwnerNames.join(", "),
                        owner_count: aOwnerNames.length
                    });
                }));
                oModel.setProperty("/selectedPropertyId", null);
                oModel.setProperty("/selectedProperty", null);
                this.byId("propertiesTable").removeSelections(true);
                this._applyFiltersAndSort();
            } catch (oError) {
                // handled by API
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        onFilterChange: function () {
            this._applyFiltersAndSort();
        },

        onClearFilters: function () {
            this.getModel("propertyFilters").setData({
                searchQuery: "",
                conditionKey: ""
            });
            this._applyFiltersAndSort();
        },

        _applyFiltersAndSort: function () {
            var oFilterData = this.getModel("propertyFilters").getData() || {};
            var sQuery = (oFilterData.searchQuery || "").trim();
            var sCondition = (oFilterData.conditionKey || "").trim();
            var aFilters = [];
            var oBinding = this.byId("propertiesTable").getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("address_line", FilterOperator.Contains, sQuery),
                        new Filter("city", FilterOperator.Contains, sQuery),
                        new Filter("province", FilterOperator.Contains, sQuery),
                        new Filter("subalterno", FilterOperator.Contains, sQuery),
                        new Filter("owner_names", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sCondition) {
                aFilters.push(new Filter("property_condition", FilterOperator.EQ, sCondition));
            }

            oBinding.filter(aFilters, "Application");
            oBinding.sort(new Sorter(this._oSortState.path, this._oSortState.descending));
        },

        onRefreshProperties: async function () {
            await this._loadProperties();
        },

        onOpenSortDialog: function () {
            var oBundle = this.getResourceBundle();

            if (!this._oSortDialog) {
                this._oSortDialog = new ViewSettingsDialog({
                    confirm: this.onSortConfirm.bind(this),
                    sortItems: [
                        new ViewSettingsItem({ key: "address_line", text: oBundle.getText("propertiesSortAddress") }),
                        new ViewSettingsItem({ key: "city", text: oBundle.getText("propertiesSortCity") }),
                        new ViewSettingsItem({ key: "property_condition", text: oBundle.getText("propertiesSortCondition") }),
                        new ViewSettingsItem({ key: "internal_sqm", text: oBundle.getText("propertiesSortInternalSqm") })
                    ]
                });
                this.getView().addDependent(this._oSortDialog);
            }

            this._oSortDialog.open();
        },

        onSortConfirm: function (oEvent) {
            var oSortItem = oEvent.getParameter("sortItem");
            this._oSortState.path = (oSortItem && oSortItem.getKey()) || "address_line";
            this._oSortState.descending = !!oEvent.getParameter("sortDescending");
            this._applyFiltersAndSort();
        },

        onSelectionChange: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem && oItem.getBindingContext("properties");
            var oProperty = oContext ? oContext.getObject() : null;
            var oModel = this.getModel("properties");

            oModel.setProperty("/selectedProperty", oProperty);
            oModel.setProperty("/selectedPropertyId", oProperty ? oProperty.id : null);
        },

        onOpenDetail: function (oEvent) {
            var oProperty = oEvent.getSource().getBindingContext("properties").getObject();

            if (oProperty && oProperty.id) {
                this.navTo("propertyDetail", { propertyId: oProperty.id });
            }
        },

        onCreateProperty: function () {
            this._openPropertyDialog("create");
        },

        onEditProperty: function () {
            var oProperty = this.getModel("properties").getProperty("/selectedProperty");

            if (!oProperty) {
                MessageToast.show(this.getResourceBundle().getText("propertiesSelectToEdit"));
                return;
            }

            this._openPropertyDialog("edit", oProperty);
        },

        onRowEdit: function (oEvent) {
            this._openPropertyDialog("edit", oEvent.getSource().getBindingContext("properties").getObject());
            oEvent.cancelBubble();
        },

        onDeleteProperty: function () {
            var oProperty = this.getModel("properties").getProperty("/selectedProperty");

            if (!oProperty) {
                MessageToast.show(this.getResourceBundle().getText("propertiesSelectToDelete"));
                return;
            }

            this._confirmDeleteProperty(oProperty);
        },

        onRowDelete: function (oEvent) {
            this._confirmDeleteProperty(oEvent.getSource().getBindingContext("properties").getObject());
            oEvent.cancelBubble();
        },

        _confirmDeleteProperty: function (oProperty) {
            var oBundle = this.getResourceBundle();

            MessageBox.confirm(oBundle.getText("propertiesDeleteConfirm", [formatPropertyLabel(oProperty)]), {
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.DELETE) {
                        return;
                    }

                    try {
                        await ContactApi.replacePropertyContacts(oProperty.id, []);
                        await ContactApi.deleteProperty(oProperty.id);
                        MessageToast.show(oBundle.getText("propertiesDeleteSuccess"));
                        await this._loadProperties();
                    } catch (oError) {
                        // handled by API
                    }
                }.bind(this)
            });
        },

        _buildDialogContent: function () {
            var oBundle = this.getResourceBundle();

            return new VBox({
                width: "100%",
                items: [
                    new SimpleForm({
                        editable: true,
                        layout: "ResponsiveGridLayout",
                        content: [
                            new Label({ text: oBundle.getText("propertyDetailFieldAddress") }),
                            new Input({ value: "{propertyDialog>/property/address_line}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldType") }),
                            new Select({
                                selectedKey: "{propertyDialog>/property/property_type}",
                                items: {
                                    path: "typeProperties>/",
                                    templateShareable: false,
                                    template: new Item({
                                        key: "{typeProperties>key}",
                                        text: "{typeProperties>value}"
                                    })
                                }
                            }),
                            new Label({ text: oBundle.getText("propertyDetailFieldCity") }),
                            new Input({ value: "{propertyDialog>/property/city}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldPostalCode") }),
                            new Input({ value: "{propertyDialog>/property/postal_code}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldProvince") }),
                            new Input({ value: "{propertyDialog>/property/province}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldCountry") }),
                            new Input({ value: "{propertyDialog>/property/country}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldSubalterno") }),
                            new Input({ value: "{propertyDialog>/property/subalterno}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldFloor") }),
                            new Input({ value: "{propertyDialog>/property/apartment_floor}" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldInternalSqm") }),
                            new Input({ value: "{propertyDialog>/property/internal_sqm}", type: "Number" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldExternalSqm") }),
                            new Input({ value: "{propertyDialog>/property/external_sqm}", type: "Number" }),
                            new Label({ text: oBundle.getText("propertyDetailFieldCondition") }),
                            new Select({
                                selectedKey: "{propertyDialog>/property/property_condition}",
                                items: {
                                    path: "statesProperty>/",
                                    templateShareable: false,
                                    template: new Item({
                                        key: "{statesProperty>key}",
                                        text: "{statesProperty>value}"
                                    })
                                }
                            }),
                            new Label({ text: oBundle.getText("propertyDetailFieldDescription") }),
                            new TextArea({ value: "{propertyDialog>/property/description}", rows: 3 }),
                            new Label({ text: oBundle.getText("propertyDetailFieldOtherInfo") }),
                            new TextArea({ value: "{propertyDialog>/property/other_info}", rows: 3 })
                        ]
                    }),
                    new Label({ text: oBundle.getText("propertyDetailOwnersTitle") }).addStyleClass("sapUiSmallMarginTop"),
                    this._createOwnersBox()
                ]
            });
        },

        _createOwnersBox: function () {
            var oBundle = this.getResourceBundle();

            return new VBox({
                width: "100%",
                items: [
                    new VBox({
                        width: "100%",
                        items: {
                            path: "propertyDialog>/linkedContacts",
                            templateShareable: false,
                            template: new VBox({
                                width: "100%",
                                items: [
                                    new HBox({
                                        width: "100%",
                                        alignItems: "Center",
                                        wrap: "Wrap",
                                        items: [
                                            new Input({
                                                width: "100%",
                                                value: "{propertyDialog>display_value}",
                                                placeholder: oBundle.getText("propertyDetailOwnerSearchPlaceholder"),
                                                showSuggestion: true,
                                                startSuggestion: 2,
                                                suggest: this.onSuggestOwner.bind(this),
                                                suggestionItemSelected: this.onOwnerSelected.bind(this),
                                                liveChange: this.onOwnerLiveChange.bind(this)
                                            }),
                                            new Button({
                                                icon: "sap-icon://less",
                                                type: "Transparent",
                                                tooltip: oBundle.getText("propertyDetailRemoveOwnerButton"),
                                                press: this.onRemoveOwner.bind(this),
                                                visible: "{= ${propertyDialog>/linkedContacts}.length > 1 }"
                                            })
                                        ]
                                    }),
                                    new HBox({
                                        renderType: "Bare",
                                        items: [
                                            new ObjectStatus({
                                                text: "{propertyDialog>category}",
                                                state: "Information"
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new ObjectStatus({
                                                text: "{propertyDialog>status}",
                                                state: "Success"
                                            })
                                        ]
                                    }).addStyleClass("sapUiTinyMarginTop sapUiTinyMarginBottom")
                                ]
                            })
                        }
                    }),
                    new Button({
                        text: oBundle.getText("propertyDetailAddOwnerButton"),
                        icon: "sap-icon://add",
                        type: "Transparent",
                        press: this.onAddOwner.bind(this)
                    })
                ]
            });
        },

        _loadOwners: async function (iPropertyId) {
            var aOwnerLinks = await ContactApi.listPropertyOwners({ property_id: iPropertyId });

            if (!aOwnerLinks || !aOwnerLinks.length) {
                return [createEmptyOwner()];
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

        _normalizeLinkedContactsForSave: function (aLinkedContacts) {
            return (aLinkedContacts || []).filter(function (oLinkedContact) {
                return (oLinkedContact.display_value || "").trim();
            }).map(function (oOwner, iIndex) {
                return {
                    contact_id: oOwner.contact_id,
                    is_primary_owner: iIndex === 0 ? 1 : 0
                };
            });
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

        onAddOwner: function (oEvent) {
            var oModel = oEvent.getSource().getModel("propertyDialog");
            var aLinkedContacts = oModel.getProperty("/linkedContacts") || [];

            aLinkedContacts.push(createEmptyOwner());
            oModel.setProperty("/linkedContacts", aLinkedContacts);
        },

        onRemoveOwner: function (oEvent) {
            var oModel = oEvent.getSource().getModel("propertyDialog");
            var sPath = oEvent.getSource().getBindingContext("propertyDialog").getPath();
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
            var oModel = oInput.getModel("propertyDialog");
            var sPath = oInput.getBindingContext("propertyDialog").getPath();

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
            var oModel = oInput.getModel("propertyDialog");
            var sPath = oInput.getBindingContext("propertyDialog").getPath();
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

        _openPropertyDialog: async function (sMode, oProperty) {
            var bEdit = sMode === "edit";
            var oBundle = this.getResourceBundle();
            var aLinkedContacts = bEdit && oProperty && oProperty.id
                ? await this._loadOwners(oProperty.id)
                : [createEmptyOwner()];
            var oDialog = new Dialog({
                title: bEdit ? oBundle.getText("propertiesDialogEditTitle") : oBundle.getText("propertiesDialogCreateTitle"),
                contentWidth: "42rem",
                resizable: true,
                type: "Message",
                content: [this._buildDialogContent()],
                beginButton: new Button({
                    text: oBundle.getText("propertiesDialogSaveButton"),
                    type: "Emphasized",
                    press: async function () {
                        var oDialogData = oDialog.getModel("propertyDialog").getData();
                        var oPayload = oDialogData.property || {};
                        var oSavedProperty;

                        if (!(oPayload.address_line || "").trim() || !(oPayload.city || "").trim()) {
                            MessageToast.show(oBundle.getText("propertiesValidationAddressRequired"));
                            return;
                        }

                        if (!this._validateLinkedContacts(oDialogData.linkedContacts)) {
                            return;
                        }

                        try {
                            if (bEdit) {
                                oSavedProperty = await ContactApi.updateProperty(oProperty.id, oPayload);
                            } else {
                                oSavedProperty = await ContactApi.createProperty(Object.assign({
                                    user_id: this.getModel("session").getProperty("/userId") || 1
                                }, oPayload));
                            }

                            await ContactApi.replacePropertyContacts(
                                oSavedProperty.id,
                                this._normalizeLinkedContactsForSave(oDialogData.linkedContacts)
                            );

                            MessageToast.show(oBundle.getText(bEdit ? "propertiesUpdateSuccess" : "propertiesCreateSuccess"));
                            oDialog.close();
                            await this._loadProperties();

                            if (!bEdit && oSavedProperty && oSavedProperty.id) {
                                this.navTo("propertyDetail", { propertyId: oSavedProperty.id });
                            }
                        } catch (oError) {
                            // handled by API
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: oBundle.getText("propertiesDialogCancelButton"),
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.setModel(new JSONModel({
                property: Object.assign(createEmptyProperty(), oProperty || {}),
                linkedContacts: aLinkedContacts
            }), "propertyDialog");
            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
