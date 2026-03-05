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
        "surplus_distribution",
        "seminar_payment",
        "distribution_marker",
        "professor_earning",
        "professor_excess_bonus",
        "ref_pool_to_professor"
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
      "enum": ["pending", "completed", "cancelled", "rejected", "held"],
      "default": "completed"
    }
  },
  "required": ["user_email", "type", "amount"]
};

export default Transaction;
