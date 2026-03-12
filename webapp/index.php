<?php
session_start();
$isAuthorized = !empty($_SESSION['crm_user']);
$userId = isset($_SESSION['crm_user']['id']) ? (int) $_SESSION['crm_user']['id'] : null;
$firstName = isset($_SESSION['crm_user']['first_name']) ? (string) $_SESSION['crm_user']['first_name'] : '';
$lastName = isset($_SESSION['crm_user']['last_name']) ? (string) $_SESSION['crm_user']['last_name'] : '';
$email = isset($_SESSION['crm_user']['email']) ? (string) $_SESSION['crm_user']['email'] : '';
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trade Immobiliare CRM</title>
    <script>
        window.CRM_CONFIG = {
            authorized: <?php echo $isAuthorized ? 'true' : 'false'; ?>,
            userId: <?php echo $userId !== null ? $userId : 'null'; ?>,
            firstName: <?php echo json_encode($firstName, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>,
            lastName: <?php echo json_encode($lastName, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>,
            email: <?php echo json_encode($email, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>,
            apiBaseUrl: "../api"
        };
    </script>
    <script
        id="sap-ui-bootstrap"
        src="https://sdk.openui5.org/resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-libs="sap.f,sap.m,sap.ui.layout"
        data-sap-ui-compatVersion="edge"
        data-sap-ui-async="true"
        data-sap-ui-oninit="module:crm/bootstrap"
        data-sap-ui-resourceroots='{"crm": "./"}'>
    </script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content"></body>
</html>
