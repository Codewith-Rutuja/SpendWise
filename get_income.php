<?php
include 'db.php';
$result = $conn->query("SELECT amount FROM income WHERE id = 1");
$row = $result->fetch_assoc();
echo json_encode($row);
?>
