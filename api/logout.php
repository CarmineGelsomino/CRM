<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

unset($_SESSION['crm_user']);
session_destroy();

echo json_encode(['authorized' => false]);
