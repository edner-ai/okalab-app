const Transaction = {
  "name": "Transaction",
  "type": "object",
  "properties": {
    "wallet_id": {
      "type": "string",
      "description": "ID del wallet"
    },
    "user_email": {
      "type": "string",
      "description": "Email del usuario"
    },
    "type": {
      "type": "string",
      "enum": [
        "seminar_income",
        "referral_bonus",
        "platform_fee",
        "withdrawal",
        "surplus_distribution"
      ],
      "description": "Tipo de transacción"
    },
    "amount": {
      "type": "number",
      "description": "Monto en USD"
    },
    "seminar_id": {
      "type": "string",
      "description": "ID del seminario relacionado"
    },
    "description": {
      "type": "string",
      "description": "Descripción de la transacción"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "completed", "cancelled"],
      "default": "completed"
    }
  },
  "required": ["user_email", "type", "amount"]
};

export default Transaction;