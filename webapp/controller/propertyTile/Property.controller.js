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
    "sap/ui/layout/form/SimpleForm",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/ui/core/Item"
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
    SimpleForm,
    ViewSettingsDialog,
    ViewSettingsItem,
    Item
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

            this._oSortState = { path: "address_line", descending: false };
            this._loadProperties();
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

            return new SimpleForm({
                editable: true,
                layout: "ResponsiveGridLayout",
                content: [
                    new Label({ text: oBundle.getText("propertyDetailFieldAddress") }),
                    new Input({ value: "{propertyDialog>/address_line}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldType") }),
                    new Select({
                        selectedKey: "{propertyDialog>/property_type}",
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
                    new Input({ value: "{propertyDialog>/city}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldPostalCode") }),
                    new Input({ value: "{propertyDialog>/postal_code}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldProvince") }),
                    new Input({ value: "{propertyDialog>/province}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldCountry") }),
                    new Input({ value: "{propertyDialog>/country}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldSubalterno") }),
                    new Input({ value: "{propertyDialog>/subalterno}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldFloor") }),
                    new Input({ value: "{propertyDialog>/apartment_floor}" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldInternalSqm") }),
                    new Input({ value: "{propertyDialog>/internal_sqm}", type: "Number" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldExternalSqm") }),
                    new Input({ value: "{propertyDialog>/external_sqm}", type: "Number" }),
                    new Label({ text: oBundle.getText("propertyDetailFieldCondition") }),
                    new Select({
                        selectedKey: "{propertyDialog>/property_condition}",
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
                    new TextArea({ value: "{propertyDialog>/description}", rows: 3 }),
                    new Label({ text: oBundle.getText("propertyDetailFieldOtherInfo") }),
                    new TextArea({ value: "{propertyDialog>/other_info}", rows: 3 })
                ]
            });
        },

        _openPropertyDialog: function (sMode, oProperty) {
            var bEdit = sMode === "edit";
            var oBundle = this.getResourceBundle();
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
                        var oPayload = oDialog.getModel("propertyDialog").getData();
                        var oSavedProperty;

                        if (!(oPayload.address_line || "").trim() || !(oPayload.city || "").trim()) {
                            MessageToast.show(oBundle.getText("propertiesValidationAddressRequired"));
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

            oDialog.setModel(new JSONModel(Object.assign(createEmptyProperty(), oProperty || {})), "propertyDialog");
            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
