/**
 * Quotation Payments Verification Types
 *
 * Defines TypeScript / JSDoc types for:
 * GET  /api/v2/quotation-payments/:id/:paymentId/verify-view
 * PATCH /api/v2/quotation-payments/:id/:paymentId/verify
 */

/**
 * @typedef {'CASH' | 'ACCOUNT' | 'UPI'} PaymentMethod
 */

/**
 * @typedef {Object} PaymentVerifyProof
 * @property {boolean} hasProofImage
 * @property {string | null} proofImage
 * @property {string | null} proofImageUrl
 * @property {string | null} [fileType]
 */

/**
 * @typedef {Object} PaymentVerification
 * @property {boolean} isVerified
 * @property {string | null} verifiedBy
 * @property {string | null} verifiedAt
 * @property {string | null} verificationNotes
 * @property {boolean} canVerify
 * @property {string | number | null} blockingPaymentId
 */

/**
 * @typedef {Object} QuotationVerifyPricing
 * @property {number} subTotal
 * @property {number} withoutGstTotal
 * @property {number} withGstTotal
 */

/**
 * @typedef {Object} QuotationVerifyProgress
 * @property {number} totalPaid
 * @property {number} withGstBalance
 * @property {number} withoutGstBalance
 * @property {'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID'} paymentStatus
 */

/**
 * @typedef {Object} QuotationVerifyContext
 * @property {number} quotationId
 * @property {string} quotationTitle
 * @property {string} propertyName
 * @property {string} clientName
 * @property {string} mobileNumber
 * @property {string} [clientMobile]
 * @property {string} siteAddress
 * @property {boolean} isConfirmed
 * @property {'PENDING' | 'APPLIED' | 'OPTED_OUT' | string} gstDecision
 * @property {string | null} customerGstNumber
 * @property {QuotationVerifyPricing} pricing
 * @property {QuotationVerifyProgress} progress
 * @property {number} totalWithGst
 * @property {number} totalPaid
 * @property {number} balanceAmount
 * @property {string} paymentStatus
 */

/**
 * @typedef {Object} BankAccountDetails
 * @property {string} [accountName]
 * @property {string} [bankName]
 * @property {string} [accountNumber]
 * @property {string} [ifscCode]
 * @property {string} [branchName]
 * @property {string} [beneficiary]
 */

/**
 * @typedef {Object} QuotationPaymentRecord
 * @property {number | string} id
 * @property {string} paymentId
 * @property {number} amount
 * @property {PaymentMethod} paymentMethod
 * @property {string | null} voucher
 * @property {BankAccountDetails | string | null} account
 * @property {string | null} upiId
 * @property {string | null} referenceNumber
 * @property {string | null} notes
 * @property {string | null} receivedBy
 * @property {string} paymentDate
 * @property {string} createdAt
 * @property {number} balanceBefore
 * @property {number} balanceAfter
 * @property {boolean} isFinalPayment
 * @property {boolean | null} applyGst
 * @property {number | string | null} previousPaymentId
 * @property {string | null} proofImage
 * @property {string | null} proofImageUrl
 * @property {boolean} isVerified
 */

/**
 * @typedef {Object} QuotationPaymentVerifyViewData
 * @property {number | string} id
 * @property {string} paymentId
 * @property {number} amount
 * @property {PaymentMethod} paymentMethod
 * @property {string | null} voucher
 * @property {BankAccountDetails | string | null} account
 * @property {string | null} upiId
 * @property {string | null} referenceNumber
 * @property {string | null} notes
 * @property {string | null} receivedBy
 * @property {string} paymentDate
 * @property {string} createdAt
 * @property {number} balanceBefore
 * @property {number} balanceAfter
 * @property {boolean} isFinalPayment
 * @property {boolean | null} applyGst
 * @property {number | string | null} previousPaymentId
 * @property {string | null} proofImage
 * @property {string | null} proofImageUrl
 * @property {boolean} isVerified
 * @property {PaymentVerifyProof} proof
 * @property {PaymentVerification} verification
 * @property {QuotationVerifyContext} quotation
 * @property {QuotationPaymentRecord} payment
 */

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  ACCOUNT: 'ACCOUNT',
  UPI: 'UPI',
};

export const GST_DECISIONS = {
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  OPTED_OUT: 'OPTED_OUT',
};

export const PAYMENT_STATUSES = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  FULLY_PAID: 'FULLY_PAID',
};

/**
 * @typedef {Object} AddAdditionalServiceRequest
 * @property {string} title - Required non-empty name of the additional service
 * @property {number} [totalPrice] - Total price in ₹. Auto-calculated as sqft * rate if omitted
 * @property {number} [sqft] - Area in sqft (default 0)
 * @property {number} [rate] - Rate per sqft in ₹ (default 0)
 * @property {string} [warranty] - Warranty period string (e.g. "2 Years", default "0")
 * @property {string | null} [notes] - Optional remarks or details (null or omitted is valid)
 */

/**
 * @typedef {Object} AdditionalService
 * @property {number} id
 * @property {number} quotationId
 * @property {string} title
 * @property {number} sqft
 * @property {number} rate
 * @property {number} totalPrice
 * @property {string} warranty
 * @property {string | null} notes
 * @property {string} addedBy
 * @property {string} createdAt
 */

/**
 * @typedef {'PENDING' | 'READY' | 'GENERATED'} ReceiptStatus
 */

export const RECEIPT_STATUSES = {
  PENDING: 'PENDING',
  READY: 'READY',
  GENERATED: 'GENERATED',
};

/**
 * @typedef {Object} ReceiptState
 * @property {boolean} canGenerateReceipt
 * @property {boolean} isReceiptGenerated
 * @property {string | null} receiptNumber
 * @property {string | null} receiptGeneratedAt
 * @property {boolean} isReceiptLocked
 * @property {ReceiptStatus} receiptStatus
 */

/**
 * @typedef {Object} FinalReceiptCustomer
 * @property {string} name
 * @property {string} mobileNumber
 * @property {string} address
 * @property {string | null} [gstNumber]
 */

/**
 * @typedef {Object} FinalReceiptServiceItem
 * @property {number} id
 * @property {string} title
 * @property {number} sqft
 * @property {number} rate
 * @property {number} totalPrice
 * @property {boolean} isAdditional
 * @property {string} [warranty]
 */

/**
 * @typedef {Object} FinalReceiptPaymentItem
 * @property {number | string} id
 * @property {string | null} [previousPaymentId]
 * @property {number} amount
 * @property {string} paymentMethod
 * @property {string | null} [upiId]
 * @property {string | null} [voucher]
 * @property {string | null} [notes]
 * @property {string | null} [receivedBy]
 * @property {boolean} isVerified
 * @property {string | null} [verifiedBy]
 * @property {string} createdAt
 */

/**
 * @typedef {Object} FinalReceiptData
 * @property {string} receiptNumber
 * @property {string} receiptDate
 * @property {number} quotationId
 * @property {string} quotationTitle
 * @property {FinalReceiptCustomer} customer
 * @property {string | null} customerGstNumber
 * @property {string} propertyAddress
 * @property {string} taxDecision
 * @property {boolean} isGstConfirmed
 * @property {boolean} isReceiptGenerated
 * @property {boolean} isReceiptLocked
 * @property {string} receiptGeneratedAt
 * @property {number} originalTotalPrice
 * @property {number} additionalAmount
 * @property {number} grossSubtotal
 * @property {number} discountPercentage
 * @property {number} discountAmount
 * @property {number} subtotalAfterDiscount
 * @property {boolean} withGst
 * @property {number} gstPercentage
 * @property {number} gstAmount
 * @property {number} cgst
 * @property {number} sgst
 * @property {number} grandTotal
 * @property {number} totalPaid
 * @property {number} balanceAmount
 * @property {string} paymentStatus
 * @property {boolean} allServicesCompleted
 * @property {boolean} canGenerateReceipt
 * @property {ReceiptStatus} receiptStatus
 * @property {FinalReceiptServiceItem[]} services
 * @property {FinalReceiptPaymentItem[]} payments
 * @property {Object} [companyContact]
 * @property {string} [terms]
 */

/**
 * @typedef {Object} ReceiptSettings
 * @property {number} [id]
 * @property {string} withoutGstPrefix
 * @property {number} withoutGstNextNumber
 * @property {string} withGstPrefix
 * @property {string} withGstCode
 * @property {string} currentFinancialYear
 * @property {string} nextWithoutGstReceiptNumber
 * @property {string} nextWithGstReceiptNumber
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} ExistingServiceDetail
 * @property {number} id
 * @property {number} area
 * @property {number} rate
 * @property {number} amount
 */

/**
 * @typedef {Object} QuotationServiceOptionItem
 * @property {number} serviceId - FK to services.id
 * @property {string} serviceName - Master service name
 * @property {'SingleTier' | 'MultiTier'} tierType - SingleTier or MultiTier
 * @property {number | null} serviceDetailId - FK to service_details.id
 * @property {string} subtitle - Specification / variation subtitle
 * @property {string} description - Specification description
 * @property {number} rate - Rate per sq.ft
 * @property {string} warranty - Warranty duration string (e.g. "5 Years")
 * @property {number | null} packageId - FK to packages.id
 * @property {string | null} packageName - Package title
 * @property {'Economy' | 'Premium' | 'Elite' | 'None'} packageTier - Package tier category
 * @property {boolean} alreadyAdded - True if this service is already present in quotation
 * @property {ExistingServiceDetail | null} existingService - Existing service stats if alreadyAdded
 */

/**
 * @typedef {Object} QuotationServiceOptionsResponse
 * @property {number} quotationId
 * @property {'Economy' | 'Premium' | 'Elite' | 'None'} tier
 * @property {string[]} allowedTiers
 * @property {QuotationServiceOptionItem[]} services
 * @property {number} existingServicesCount
 */

/**
 * @typedef {Object} V2AddAdditionalServiceFromExistingDto
 * @property {number} serviceId - FK to services.id (required)
 * @property {number | null} [serviceDetailId] - FK to service_details.id (optional)
 * @property {number} area - sqft / area (must be > 0)
 * @property {number} rate - price per sqft (must be > 0)
 * @property {string} [description] - override description
 * @property {'add' | 'replace'} [mode] - If service already exists: 'add' (adds to area) or 'replace' (overwrites area)
 */

