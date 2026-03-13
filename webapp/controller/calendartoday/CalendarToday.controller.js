sap.ui.define([
    "crm/controller/BaseController.controller",
    "crm/model/ContactApi",
    "crm/model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/DateTimePicker",
    "sap/ui/core/ListItem"
], function (
    BaseController,
    ContactApi,
    formatter,
    JSONModel,
    MessageToast,
    MessageBox,
    Dialog,
    Button,
    Label,
    Input,
    TextArea,
    Select,
    Item,
    DateTimePicker,
    ListItem
) {
    "use strict";

    function parseApiDateTime(sValue) {
        if (!sValue) {
            return null;
        }

        var sNormalized = String(sValue).replace(" ", "T");
        var oDate = new Date(sNormalized);
        return Number.isNaN(oDate.getTime()) ? null : oDate;
    }

    function formatDateTimeForApi(oDate) {
        if (!(oDate instanceof Date) || Number.isNaN(oDate.getTime())) {
            return null;
        }

        var oLocal = new Date(oDate.getTime() - (oDate.getTimezoneOffset() * 60000));
        return oLocal.toISOString().slice(0, 19).replace("T", " ");
    }

    function normalizeText(sValue) {
        return (sValue || "").toLowerCase().trim();
    }

    function mapActivityTypeToIcon(sType) {
        var mIcons = {
            chiamata: "sap-icon://call",
            appuntamento: "sap-icon://appointment-2",
            email: "sap-icon://email",
            todo: "sap-icon://task"
        };

        return mIcons[sType] || "sap-icon://calendar";
    }

    function formatTimeValue(oDate) {
        if (!(oDate instanceof Date) || Number.isNaN(oDate.getTime())) {
            return "";
        }

        return oDate.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    return BaseController.extend("crm.controller.calendartoday.CalendarToday", {
        formatter: formatter,

        onInit: function () {
            var oBundle = this.getResourceBundle();
            var aStatusOptions = [{ key: "", value: oBundle.getText("calendarTodayFilterAllStatuses") }].concat(
                this._getEditableActivityStates().map(function (oState) {
                    return { key: oState.key, value: oState.value };
                })
            );
            var aTypeOptions = [{ key: "", value: oBundle.getText("calendarTodayFilterAllTypes") }].concat(
                (this.getOwnerComponent().getModel("activityTypes").getData() || []).map(function (oType) {
                    return { key: oType.key, value: oType.value };
                })
            );

            this.setModel(new JSONModel({
                isBusy: false,
                selectedDate: new Date(),
                startHour: new Date().getHours(),
                search: "",
                status: "",
                type: "",
                statusOptions: aStatusOptions,
                typeOptions: aTypeOptions,
                contactOptions: [],
                allRows: [],
                rows: [],
                appointments: [],
                summary: {
                    total: 0,
                    contacts: 0
                }
            }), "calendarToday");

            this.getRouter().getRoute("calendarToday").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this.getModel("calendarToday").setProperty("/selectedDate", new Date());
            this.getModel("calendarToday").setProperty("/startHour", new Date().getHours());
            this._loadTodayActivities();
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

        _mapStatusToAppointmentType: function (sStatus) {
            var aItems = this.getOwnerComponent().getModel("calendarTodayLegend").getProperty("/items") || [];
            var oMatch = aItems.find(function (oItem) {
                return oItem.status === sStatus;
            });

            return (oMatch && oMatch.type) || "Type09";
        },

        _getLegendItemByStatus: function (sStatus) {
            var aItems = this.getOwnerComponent().getModel("calendarTodayLegend").getProperty("/items") || [];

            return aItems.find(function (oItem) {
                return oItem.status === sStatus;
            }) || null;
        },

        _buildActivityPayloadFromDialog: function (mIds, oBaseActivity, bIsEdit) {
            var sStatus = sap.ui.getCore().byId(mIds.status).getSelectedKey();
            var oContactField = mIds.contact ? sap.ui.getCore().byId(mIds.contact) : null;
            var sContactId = oContactField ? oContactField.data("selectedContactId") : oBaseActivity.contact_id;

            return {
                user_id: oBaseActivity.user_id || this.getModel("session").getProperty("/userId") || 1,
                contact_id: sContactId ? Number(sContactId) : null,
                title: sap.ui.getCore().byId(mIds.title).getValue().trim(),
                activity_type: sap.ui.getCore().byId(mIds.type).getSelectedKey(),
                description: sap.ui.getCore().byId(mIds.description).getValue(),
                reminder_at: formatDateTimeForApi(sap.ui.getCore().byId(mIds.reminder).getDateValue()),
                priority: sap.ui.getCore().byId(mIds.priority).getSelectedKey(),
                status: sStatus,
                completed_at: sStatus === "completato" ? formatDateTimeForApi(new Date()) : (bIsEdit ? null : undefined)
            };
        },

        _openActivityDialog: function (oOptions) {
            var oBundle = this.getResourceBundle();
            var aActivityTypes = this.getOwnerComponent().getModel("activityTypes").getData() || [];
            var aActivityStates = this._getEditableActivityStates();
            var oActivity = oOptions.activity || {};
            var mIds = {
                contact: oOptions.showContactSelect ? (oOptions.idPrefix + "Contact") : null,
                title: oOptions.idPrefix + "Title",
                type: oOptions.idPrefix + "Type",
                description: oOptions.idPrefix + "Description",
                reminder: oOptions.idPrefix + "Reminder",
                priority: oOptions.idPrefix + "Priority",
                status: oOptions.idPrefix + "Status"
            };
            var aDialogContent = [];
            var aDialogButtons;

            if (oOptions.showContactSelect) {
                aDialogContent.push(new Label({ text: oBundle.getText("calendarTodayContactField"), required: true }));
                aDialogContent.push(new Input(mIds.contact, {
                    value: oOptions.selectedContactName || "",
                    width: "100%",
                    showSuggestion: true,
                    startSuggestion: 3,
                    suggest: this.onSuggestContact.bind(this),
                    suggestionItemSelected: this.onContactSuggestionSelected.bind(this),
                    liveChange: this.onContactLiveChange.bind(this)
                }));
            }

            aDialogContent = aDialogContent.concat([
                new Label({ text: oBundle.getText("contactDetailActivityFieldTitle"), required: true }),
                new Input(mIds.title, { value: oActivity.title || "", width: "100%" }),
                new Label({ text: oBundle.getText("contactDetailActivityFieldType") }),
                new Select(mIds.type, {
                    selectedKey: oActivity.activity_type || "chiamata",
                    width: "100%",
                    items: aActivityTypes.map(function (oType) {
                        return new Item({ key: oType.key, text: oType.value });
                    })
                }),
                new Label({ text: oBundle.getText("contactDetailActivityFieldDescription") }),
                new TextArea(mIds.description, { value: oActivity.description || "", width: "100%", rows: 4 }),
                new Label({ text: oBundle.getText("contactDetailActivityFieldReminder") }),
                new DateTimePicker(mIds.reminder, {
                    valueFormat: "yyyy-MM-dd HH:mm:ss",
                    displayFormat: "dd/MM/yyyy HH:mm",
                    dateValue: parseApiDateTime(oActivity.reminder_at),
                    width: "100%"
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
                    selectedKey: oActivity.status || this._getDefaultActivityStatusKey(),
                    width: "100%",
                    items: aActivityStates.map(function (oState) {
                        return new Item({ key: oState.key, text: oState.value });
                    })
                })
            ]);

            aDialogButtons = [
                new Button({
                    text: oOptions.confirmText,
                    type: "Emphasized",
                    press: async function () {
                        var oPayload = this._buildActivityPayloadFromDialog(mIds, oActivity, true);

                        if (!oPayload.contact_id) {
                            MessageToast.show(oBundle.getText("calendarTodayContactRequired"));
                            return;
                        }

                        if (!oPayload.title) {
                            MessageToast.show(oBundle.getText("contactDetailActivityTitleRequired"));
                            return;
                        }

                        try {
                            await oOptions.onConfirm(oPayload);
                            MessageToast.show(oOptions.successMessage);
                            oDialog.close();
                        } catch (oError) {
                            // Error feedback handled by ContactApi
                        }
                    }.bind(this)
                })
            ];

            if (oOptions.onDelete) {
                aDialogButtons.push(new Button({
                    text: oBundle.getText("calendarTodayDeleteButton"),
                    type: "Reject",
                    press: async function () {
                        try {
                            await oOptions.onDelete();
                            MessageToast.show(oBundle.getText("calendarTodayDeleteSuccess"));
                            oDialog.close();
                        } catch (oError) {
                            // Error feedback handled by ContactApi
                        }
                    }
                }));
            }

            aDialogButtons.push(new Button({
                text: oBundle.getText("contactsDialogCancelButton"),
                press: function () {
                    oDialog.close();
                }
            }));

            var oDialog = new Dialog({
                title: oOptions.title,
                contentWidth: "30rem",
                state: "Information",
                type: "Message",
                content: aDialogContent,
                buttons: aDialogButtons,
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);

            if (oOptions.showContactSelect && oOptions.selectedContactId) {
                sap.ui.getCore().byId(mIds.contact).data("selectedContactId", String(oOptions.selectedContactId));
            }

            oDialog.open();
        },

        _isToday: function (oDate) {
            if (!(oDate instanceof Date) || Number.isNaN(oDate.getTime())) {
                return false;
            }

            var oToday = new Date();
            return oDate.getFullYear() === oToday.getFullYear() &&
                oDate.getMonth() === oToday.getMonth() &&
                oDate.getDate() === oToday.getDate();
        },

        _contactDisplayName: function (oContact) {
            var sFullName = [oContact.first_name, oContact.last_name].filter(Boolean).join(" ").trim();
            return sFullName || oContact.email || String(oContact.id);
        },

        _buildContactOptions: function (aContacts) {
            return (aContacts || []).map(function (oContact) {
                var sName = this._contactDisplayName(oContact);
                var sMeta = [oContact.email, oContact.primary_phone].filter(Boolean).join(" - ");

                return {
                    key: String(oContact.id),
                    text: sMeta ? (sName + " (" + sMeta + ")") : sName,
                    name: sName,
                    additionalText: sMeta
                };
            }.bind(this));
        },

        _formatAppointmentForDisplay: function (oAppointment) {
            var sTimeRange = [formatTimeValue(oAppointment.startDate), formatTimeValue(oAppointment.endDate)].filter(Boolean).join(" - ");
            var sDescription = (oAppointment.description || "").trim();
            var sTooltipParts = [
                oAppointment.title,
                oAppointment.contactName,
                sTimeRange,
                sDescription
            ].filter(Boolean);

            return Object.assign({}, oAppointment, {
                text: [oAppointment.contactName, sTimeRange].filter(Boolean).join(" - "),
                icon: mapActivityTypeToIcon(oAppointment.activityType),
                tooltip: sTooltipParts.join("\n")
            });
        },

        _toAppointment: function (oActivity, oContact) {
            var oStartDate = parseApiDateTime(oActivity.reminder_at);
            var oEndDate = oStartDate ? new Date(oStartDate.getTime() + (60 * 60 * 1000)) : null;
            var sContactName = this._contactDisplayName(oContact);
            var sContactInfo = [sContactName, oContact.email, oContact.primary_phone].filter(Boolean).join(" • ");

            return {
                id: String(oActivity.id),
                activityId: oActivity.id,
                title: oActivity.title || this.getResourceBundle().getText("calendarTodayUntitledActivity"),
                text: sContactInfo,
                type: this._mapStatusToAppointmentType(oActivity.status),
                color: (this._getLegendItemByStatus(oActivity.status) || {}).colorHex,
                startDate: oStartDate,
                endDate: oEndDate,
                status: oActivity.status || "",
                activityType: oActivity.activity_type || "",
                priority: oActivity.priority || "",
                contactId: oContact.id,
                contactName: sContactName,
                contactEmail: oContact.email || "",
                contactPhone: oContact.primary_phone || "",
                description: oActivity.description || "",
                reminderAt: oActivity.reminder_at || ""
            };
        },

        async _loadTodayActivities() {
            var oModel = this.getModel("calendarToday");
            oModel.setProperty("/isBusy", true);

            try {
                var aContacts = await ContactApi.listContacts();
                var aResponses = await Promise.all((aContacts || []).map(function (oContact) {
                    return ContactApi.listActivities(oContact.id).then(function (aActivities) {
                        return {
                            contact: oContact,
                            activities: aActivities || []
                        };
                    });
                }));

                var aRows = aResponses
                    .map(function (oEntry) {
                        var aAppointments = (oEntry.activities || [])
                            .filter(function (oActivity) {
                                return this._isToday(parseApiDateTime(oActivity.reminder_at));
                            }.bind(this))
                            .map(function (oActivity) {
                                return this._toAppointment(oActivity, oEntry.contact);
                            }.bind(this));

                        if (!aAppointments.length) {
                            return null;
                        }

                        return {
                            id: "contact-" + oEntry.contact.id,
                            title: this._contactDisplayName(oEntry.contact),
                            text: [oEntry.contact.email, oEntry.contact.primary_phone].filter(Boolean).join(" • "),
                            icon: "sap-icon://customer",
                            contactId: oEntry.contact.id,
                            contactName: this._contactDisplayName(oEntry.contact),
                            appointments: aAppointments
                        };
                    }.bind(this))
                    .filter(Boolean);

                oModel.setProperty("/contactOptions", this._buildContactOptions(aContacts));
                oModel.setProperty("/allRows", aRows);
                this._applyFilters();
            } catch (oError) {
                MessageToast.show(this.getResourceBundle().getText("calendarTodayLoadError"));
            } finally {
                oModel.setProperty("/isBusy", false);
            }
        },

        onFilterActivities: function (oEvent) {
            var oSource = oEvent.getSource();
            var oModel = this.getModel("calendarToday");

            if (oSource && oSource.isA("sap.m.SearchField")) {
                oModel.setProperty("/search", (oEvent.getParameter("query") || oEvent.getParameter("newValue") || "").trim());
            }

            this._applyFilters();
        },

        _appointmentMatchesFilters: function (oAppointment, sQuery, sStatus, sType) {
            var bQueryMatch = true;

            if (sQuery) {
                bQueryMatch = [
                    oAppointment.title,
                    oAppointment.text,
                    oAppointment.contactName,
                    oAppointment.contactEmail,
                    oAppointment.contactPhone,
                    oAppointment.description
                ].some(function (sValue) {
                    return normalizeText(sValue).indexOf(sQuery) > -1;
                });
            }

            return bQueryMatch &&
                (!sStatus || oAppointment.status === sStatus) &&
                (!sType || oAppointment.activityType === sType);
        },

        _applyFilters: function () {
            var oModel = this.getModel("calendarToday");
            var sQuery = normalizeText(oModel.getProperty("/search"));
            var sStatus = oModel.getProperty("/status");
            var sType = oModel.getProperty("/type");
            var aAllRows = oModel.getProperty("/allRows") || [];

            var aFilteredRows = aAllRows
                .map(function (oRow) {
                    var aAppointments = (oRow.appointments || []).filter(function (oAppointment) {
                        return this._appointmentMatchesFilters(oAppointment, sQuery, sStatus, sType);
                    }.bind(this)).map(function (oAppointment) {
                        return this._formatAppointmentForDisplay(oAppointment);
                    }.bind(this));

                    if (!aAppointments.length) {
                        return null;
                    }

                    return Object.assign({}, oRow, { appointments: aAppointments });
                }.bind(this))
                .filter(Boolean);

            var iTotalActivities = aFilteredRows.reduce(function (iTotal, oRow) {
                return iTotal + ((oRow.appointments && oRow.appointments.length) || 0);
            }, 0);
            var aFilteredAppointments = aFilteredRows.reduce(function (aResult, oRow) {
                return aResult.concat(oRow.appointments || []);
            }, []);

            oModel.setProperty("/rows", aFilteredRows);
            oModel.setProperty("/appointments", aFilteredAppointments);
            oModel.setProperty("/summary/contacts", aFilteredRows.length);
            oModel.setProperty("/summary/total", iTotalActivities);
        },

        onAppointmentSelect: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");
            if (!oAppointment) {
                return;
            }

            this._oSelectedAppointment = oAppointment.getBindingContext("calendarToday").getObject();
            this.onEditSelectedActivity();
        },

        onContactLiveChange: function (oEvent) {
            var oInput = oEvent.getSource();
            oInput.data("selectedContactId", null);
        },

        onSuggestContact: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = normalizeText(oEvent.getParameter("suggestValue"));
            var aContacts = this.getModel("calendarToday").getProperty("/contactOptions") || [];
            var aMatches;

            if (sValue.length < 3) {
                oInput.destroySuggestionItems();
                return;
            }

            aMatches = aContacts.filter(function (oContact) {
                return normalizeText([oContact.name, oContact.text, oContact.additionalText].join(" ")).indexOf(sValue) !== -1;
            }).slice(0, 10);

            oInput.destroySuggestionItems();
            aMatches.forEach(function (oContact) {
                oInput.addSuggestionItem(new ListItem({
                    key: oContact.key,
                    text: oContact.name,
                    additionalText: oContact.additionalText || ""
                }));
            });
        },

        onContactSuggestionSelected: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oInput = oEvent.getSource();

            if (!oSelectedItem) {
                return;
            }

            oInput.setValue(oSelectedItem.getText());
            oInput.data("selectedContactId", oSelectedItem.getKey());
        },

        onAddActivity: function () {
            var oModel = this.getModel("calendarToday");
            var aContactOptions = oModel.getProperty("/contactOptions") || [];
            var iSelectedContactId = this._oSelectedAppointment && this._oSelectedAppointment.contactId;
            var oSelectedContact = aContactOptions.find(function (oContact) {
                return oContact.key === String(iSelectedContactId);
            });

            this._openActivityDialog({
                idPrefix: "newCalendarTodayActivity",
                activity: {
                    contact_id: iSelectedContactId || "",
                    reminder_at: formatDateTimeForApi(new Date())
                },
                showContactSelect: true,
                selectedContactId: iSelectedContactId || "",
                selectedContactName: oSelectedContact ? oSelectedContact.name : "",
                contactOptions: aContactOptions,
                title: this.getResourceBundle().getText("contactDetailNewActivityTitle"),
                confirmText: this.getResourceBundle().getText("contactDetailAddButton"),
                successMessage: this.getResourceBundle().getText("contactDetailActivityAdded"),
                onConfirm: async function (oPayload) {
                    await ContactApi.createActivity(oPayload);
                    this._oSelectedAppointment = null;
                    await this._loadTodayActivities();
                }.bind(this)
            });
        },

        onEditSelectedActivity: function () {
            if (!this._oSelectedAppointment || !this._oSelectedAppointment.activityId) {
                MessageToast.show(this.getResourceBundle().getText("calendarTodaySelectActivityHint"));
                return;
            }

            var oSelected = this._oSelectedAppointment;
            this._openActivityDialog({
                idPrefix: "editCalendarTodayActivity",
                activity: {
                    id: oSelected.activityId,
                    contact_id: oSelected.contactId,
                    user_id: this.getModel("session").getProperty("/userId") || 1,
                    title: oSelected.title,
                    activity_type: oSelected.activityType,
                    description: oSelected.description,
                    reminder_at: oSelected.reminderAt,
                    priority: oSelected.priority,
                    status: oSelected.status
                },
                title: this.getResourceBundle().getText("contactDetailEditActivityTitle"),
                confirmText: this.getResourceBundle().getText("contactDetailSaveActivityButton"),
                successMessage: this.getResourceBundle().getText("contactDetailActivityUpdated"),
                onConfirm: async function (oPayload) {
                    await ContactApi.updateActivity(oSelected.activityId, oPayload);
                    await this._loadTodayActivities();
                }.bind(this),
                onDelete: async function () {
                    await ContactApi.deleteActivity(oSelected.activityId);
                    this._oSelectedAppointment = null;
                    await this._loadTodayActivities();
                }.bind(this)
            });
        },

        onDeleteSelectedActivity: function () {
            if (!this._oSelectedAppointment || !this._oSelectedAppointment.activityId) {
                MessageToast.show(this.getResourceBundle().getText("calendarTodaySelectActivityHint"));
                return;
            }

            var oSelected = this._oSelectedAppointment;
            var oBundle = this.getResourceBundle();

            MessageBox.confirm(oBundle.getText("calendarTodayDeleteConfirm", [oSelected.title]), {
                title: oBundle.getText("calendarTodayDeleteTitle"),
                emphasizedAction: MessageBox.Action.DELETE,
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.DELETE) {
                        return;
                    }

                    try {
                        await ContactApi.deleteActivity(oSelected.activityId);
                        MessageToast.show(oBundle.getText("calendarTodayDeleteSuccess"));
                        this._oSelectedAppointment = null;
                        await this._loadTodayActivities();
                    } catch (oError) {
                        // Error feedback handled by ContactApi
                    }
                }.bind(this)
            });
        },

        onRefresh: function () {
            this._oSelectedAppointment = null;
            this.getModel("calendarToday").setProperty("/startHour", new Date().getHours());
            this._loadTodayActivities();
        }
    });
});
