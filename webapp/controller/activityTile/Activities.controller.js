sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/Dialog",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/DateTimePicker",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/Button",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    BaseController,
    ContactApi,
    JSONModel,
    Filter,
    FilterOperator,
    Sorter,
    Dialog,
    Label,
    Input,
    TextArea,
    DateTimePicker,
    Select,
    Item,
    Button,
    MessageBox,
    MessageToast
) {
    "use strict";

    function parseApiDateTime(sValue) {
        if (!sValue) {
            return null;
        }

        var oDate = new Date(sValue.replace(" ", "T"));
        return isNaN(oDate.getTime()) ? null : oDate;
    }

    function formatDateTimeForApi(oDate) {
        if (!oDate) {
            return null;
        }

        function pad(iValue) {
            return iValue < 10 ? "0" + iValue : String(iValue);
        }

        return [
            oDate.getFullYear(),
            pad(oDate.getMonth() + 1),
            pad(oDate.getDate())
        ].join("-") + " " + [
            pad(oDate.getHours()),
            pad(oDate.getMinutes()),
            pad(oDate.getSeconds())
        ].join(":");
    }

    return BaseController.extend("crm.controller.activityTile.Activities", {
        onInit: function () {
            this.getView().setModel(this.getOwnerComponent().getModel("session"), "session");

            this.setModel(new JSONModel({
                busy: false,
                activities: [],
                searchQuery: "",
                statusKey: "",
                typeKey: "",
                sortKey: "reminderDesc",
                typeFilters: []
            }), "activitiesPage");

            this.getRouter().getRoute("activities").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oBundle = this.getResourceBundle();
            var aTypeFilters = [{
                key: "",
                value: oBundle.getText("activitiesFilterTypeAll")
            }].concat(this.getOwnerComponent().getModel("activityTypes").getData() || []);

            this.getModel("activitiesPage").setProperty("/typeFilters", aTypeFilters);
            this._loadActivities();
        },

        _getEditableActivityStates: function () {
            return (this.getOwnerComponent().getModel("activityStates").getData() || []).filter(function (oState) {
                return !oState.isFilterOnly;
            });
        },

        async _loadActivities() {
            this.getModel("activitiesPage").setProperty("/busy", true);

            try {
                var aResponses = await Promise.all([
                    ContactApi.listActivities(),
                    ContactApi.listContacts()
                ]);

                var aActivities = aResponses[0] || [];
                var aContacts = aResponses[1] || [];
                var mContactsById = {};

                aContacts.forEach(function (oContact) {
                    mContactsById[oContact.id] = oContact;
                });

                var aEnrichedActivities = aActivities.map(function (oActivity) {
                    var oContact = mContactsById[oActivity.contact_id] || {};
                    return Object.assign({}, oActivity, {
                        contact_full_name: ((oContact.first_name || "") + " " + (oContact.last_name || "")).trim(),
                        contact_email: oContact.email || "",
                        contact_primary_phone: oContact.primary_phone || "",
                        reminder_date: parseApiDateTime(oActivity.reminder_at),
                        completed_date: parseApiDateTime(oActivity.completed_at)
                    });
                });

                this.getModel("activitiesPage").setProperty("/activities", aEnrichedActivities);
                this._applyFiltersAndSort();
            } finally {
                this.getModel("activitiesPage").setProperty("/busy", false);
            }
        },

        onRefresh: function () {
            this._loadActivities();
        },

        onFilterChange: function () {
            this._applyFiltersAndSort();
        },

        _applyFiltersAndSort: function () {
            var oModel = this.getModel("activitiesPage");
            var sQuery = (oModel.getProperty("/searchQuery") || "").trim();
            var sStatusKey = oModel.getProperty("/statusKey");
            var sTypeKey = oModel.getProperty("/typeKey");
            var sSortKey = oModel.getProperty("/sortKey");
            var aFilters = [];
            var oBinding = this.byId("activitiesTable").getBinding("items");

            if (!oBinding) {
                return;
            }

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("title", FilterOperator.Contains, sQuery),
                        new Filter("description", FilterOperator.Contains, sQuery),
                        new Filter("contact_full_name", FilterOperator.Contains, sQuery),
                        new Filter("contact_email", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sStatusKey) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatusKey));
            }

            if (sTypeKey) {
                aFilters.push(new Filter("activity_type", FilterOperator.EQ, sTypeKey));
            }

            oBinding.filter(aFilters, "Application");

            var oSorter = new Sorter("reminder_at", true);

            if (sSortKey === "reminderAsc") {
                oSorter = new Sorter("reminder_at", false);
            }

            if (sSortKey === "priorityDesc") {
                oSorter = new Sorter("priority", true);
            }

            if (sSortKey === "priorityAsc") {
                oSorter = new Sorter("priority", false);
            }

            if (sSortKey === "statusAsc") {
                oSorter = new Sorter("status", false);
            }

            if (sSortKey === "statusDesc") {
                oSorter = new Sorter("status", true);
            }

            oBinding.sort(oSorter);
        },

        _buildActivityPayloadFromDialog: function (mIds, iContactId) {
            var sStatus = sap.ui.getCore().byId(mIds.status).getSelectedKey();

            return {
                user_id: this.getModel("session").getProperty("/userId") || 1,
                contact_id: iContactId,
                title: sap.ui.getCore().byId(mIds.title).getValue().trim(),
                activity_type: sap.ui.getCore().byId(mIds.type).getSelectedKey(),
                description: sap.ui.getCore().byId(mIds.description).getValue(),
                reminder_at: formatDateTimeForApi(sap.ui.getCore().byId(mIds.reminder).getDateValue()),
                priority: sap.ui.getCore().byId(mIds.priority).getSelectedKey(),
                status: sStatus,
                completed_at: sStatus === "completato" ? formatDateTimeForApi(new Date()) : null
            };
        },

        onEditActivity: function (oEvent) {
            var oBundle = this.getResourceBundle();
            var oActivity = oEvent.getSource().getBindingContext("activitiesPage").getObject();
            var aActivityTypes = this.getOwnerComponent().getModel("activityTypes").getData() || [];
            var aActivityStates = this._getEditableActivityStates();
            var mIds = {
                title: "editActivityTitle",
                type: "editActivityType",
                description: "editActivityDescription",
                reminder: "editActivityReminder",
                priority: "editActivityPriority",
                status: "editActivityStatus"
            };

            var oDialog = new Dialog({
                title: oBundle.getText("activitiesEditDialogTitle"),
                contentWidth: "30rem",
                state: "Information",
                content: [
                    new Label({ text: oBundle.getText("activitiesContactLabel") }),
                    new Input({ value: oActivity.contact_full_name || "-", editable: false }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldTitle"), required: true }),
                    new Input(mIds.title, { value: oActivity.title || "" }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldType") }),
                    new Select(mIds.type, {
                        width: "100%",
                        selectedKey: oActivity.activity_type || "chiamata",
                        items: aActivityTypes.map(function (oType) {
                            return new Item({ key: oType.key, text: oBundle.getText(oType.i18n) });
                        })
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldDescription") }),
                    new TextArea(mIds.description, { rows: 4, value: oActivity.description || "" }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldReminder") }),
                    new DateTimePicker(mIds.reminder, {
                        width: "100%",
                        valueFormat: "yyyy-MM-dd HH:mm:ss",
                        displayFormat: "dd/MM/yyyy HH:mm",
                        dateValue: parseApiDateTime(oActivity.reminder_at)
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldPriority") }),
                    new Select(mIds.priority, {
                        selectedKey: oActivity.priority || "media",
                        width: "100%",
                        items: [
                            new Item({ key: "bassa", text: oBundle.getText("contactDetailPriorityLow") }),
                            new Item({ key: "media", text: oBundle.getText("contactDetailPriorityMedium") }),
                            new Item({ key: "alta", text: oBundle.getText("contactDetailPriorityHigh") })
                        ]
                    }),
                    new Label({ text: oBundle.getText("contactDetailActivityFieldStatus") }),
                    new Select(mIds.status, {
                        selectedKey: oActivity.status || "da_fare",
                        width: "100%",
                        items: aActivityStates.map(function (oState) {
                            return new Item({ key: oState.key, text: oState.value });
                        })
                    })
                ],
                beginButton: new Button({
                    text: oBundle.getText("contactDetailSaveActivityButton"),
                    type: "Emphasized",
                    press: async function () {
                        var oPayload = this._buildActivityPayloadFromDialog(mIds, oActivity.contact_id);

                        if (!oPayload.title) {
                            MessageToast.show(oBundle.getText("contactDetailActivityTitleRequired"));
                            return;
                        }

                        try {
                            await ContactApi.updateActivity(oActivity.id, oPayload);
                            MessageToast.show(oBundle.getText("activitiesUpdateSuccess"));
                            oDialog.close();
                            this._loadActivities();
                        } catch (oError) {
                            // Error feedback is already handled in ContactApi.
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

        onDeleteActivity: function (oEvent) {
            var oBundle = this.getResourceBundle();
            var oActivity = oEvent.getSource().getBindingContext("activitiesPage").getObject();

            MessageBox.confirm(oBundle.getText("activitiesDeleteConfirm", [oActivity.title || ""]), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        await ContactApi.deleteActivity(oActivity.id);
                        MessageToast.show(oBundle.getText("activitiesDeleteSuccess"));
                        this._loadActivities();
                    } catch (oError) {
                        // Error feedback is already handled in ContactApi.
                    }
                }.bind(this)
            });
        }
    });
});
