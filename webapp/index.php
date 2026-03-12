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
    <meta name="theme-color" content="#b68b60">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Trade CRM">
    <title>Trade Immobiliare CRM</title>
    <link rel="manifest" href="./app-manifest.php">
    <link rel="icon" href="./img/logo.webp" type="image/svg+xml">
    <link rel="apple-touch-icon" href="./img/logo-crm.svg">
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
    <script>
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", function () {
                navigator.serviceWorker.register("./service-worker.js").catch(function () {
                    // Ignore service worker registration failures to avoid blocking app bootstrap.
                });
            });
        }
    </script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content"></body>
</html>
