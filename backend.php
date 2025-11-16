<?php
header('Content-Type: application/json');
include 'db.php';

// Get action
$action = $_GET['action'] ?? '';

switch($action) {
    case 'get-data':
        // Get income
        $incomeResult = $conn->query("SELECT amount FROM income ORDER BY set_at DESC LIMIT 1");
        $income = $incomeResult->num_rows ? floatval($incomeResult->fetch_assoc()['amount']) : 0;

        // Get expenses
        $expensesResult = $conn->query("SELECT * FROM expenses ORDER BY timestamp ASC");
        $expenses = [];
        while($row = $expensesResult->fetch_assoc()){
            $expenses[] = $row;
        }

        echo json_encode(['income'=>$income, 'expenses'=>$expenses]);
        break;

    case 'set-income':
        $amount = floatval($_POST['amount'] ?? 0);
        if($amount > 0){
            $stmt = $conn->prepare("INSERT INTO income (amount) VALUES (?)");
            $stmt->bind_param("d",$amount);
            $stmt->execute();
            echo json_encode(['status'=>'success']);
        } else { echo json_encode(['status'=>'error']); }
        break;

    case 'add-expense':
        $name = $_POST['name'] ?? '';
        $amount = floatval($_POST['amount'] ?? 0);
        $category = $_POST['category'] ?? '';
        if($name && $amount > 0 && $category){
            $stmt = $conn->prepare("INSERT INTO expenses (name, amount, category) VALUES (?,?,?)");
            $stmt->bind_param("sds",$name,$amount,$category);
            $stmt->execute();
            echo json_encode(['status'=>'success']);
        } else { echo json_encode(['status'=>'error']); }
        break;

    case 'edit-expense':
        $id = intval($_POST['id'] ?? 0);
        $name = $_POST['name'] ?? '';
        $amount = floatval($_POST['amount'] ?? 0);
        $category = $_POST['category'] ?? '';
        if($id && $name && $amount > 0 && $category){
            $stmt = $conn->prepare("UPDATE expenses SET name=?, amount=?, category=? WHERE id=?");
            $stmt->bind_param("sdsi",$name,$amount,$category,$id);
            $stmt->execute();
            echo json_encode(['status'=>'success']);
        } else { echo json_encode(['status'=>'error']); }
        break;

    case 'delete-expense':
        $id = intval($_POST['id'] ?? 0);
        if($id){
            $stmt = $conn->prepare("DELETE FROM expenses WHERE id=?");
            $stmt->bind_param("i",$id);
            $stmt->execute();
            echo json_encode(['status'=>'success']);
        } else { echo json_encode(['status'=>'error']); }
        break;

    default:
        echo json_encode(['status'=>'invalid-action']);
}
case 'delete-expense':
    $id = intval($_POST['id'] ?? 0);
    if($id > 0) {
        $conn->query("DELETE FROM expenses WHERE id=$id");
        echo json_encode(['status'=>'success']);
    } else {
        echo json_encode(['status'=>'error','message'=>'Invalid ID']);
    }
    break;

$conn->close();
?>
