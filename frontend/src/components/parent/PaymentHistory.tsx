// frontend/src/components/parent/PaymentHistory.tsx

import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, DollarSign, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import type { Payment } from '../../types';
import PaymentService from '../../services/payment';

const PaymentHistory: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const paymentList = await PaymentService.getMyStudentsPayments();
      setPayments(paymentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to safely convert amount to number
  const toNumber = (amount: number | string): number => {
    return typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not recorded';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-SG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number | string) => {
    const numAmount = toNumber(amount);
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD'
    }).format(numAmount);
  };

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-SG', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getPaymentStatusColor = (paid: boolean) => {
    return paid 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const getPaymentMethodDisplay = (method?: string) => {
    switch (method) {
      case 'card':
        return 'Card';
      case 'bank_transfer':
        return 'Transfer';
      case 'cash':
        return 'Cash';
      case 'online':
        return 'Online';
      default:
        return 'Card';
    }
  };

  // Group payments by student
  const paymentsByStudent = payments.reduce((acc, payment) => {
    const studentName = payment.student_name;
    if (!acc[studentName]) {
      acc[studentName] = [];
    }
    acc[studentName].push(payment);
    return acc;
  }, {} as Record<string, Payment[]>);

  // Calculate summary stats with proper type handling
  const totalPaid = payments.filter(p => p.paid).reduce((sum, p) => sum + toNumber(p.amount), 0);
  const totalOutstanding = payments.filter(p => !p.paid).reduce((sum, p) => sum + toNumber(p.amount), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthPayments = payments.filter(p => p.month === currentMonth);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-lg text-gray-700">Loading payment history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <CreditCard className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Payment History</h1>
            <p className="text-gray-600">Track payments for all your children</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadPayments}
            className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="text-green-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Total Paid</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatAmount(totalPaid)}</p>
          <p className="text-sm text-gray-500 mt-1">All successful payments</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <XCircle className="text-red-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Outstanding</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatAmount(totalOutstanding)}</p>
          <p className="text-sm text-gray-500 mt-1">Pending payments</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar className="text-blue-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">This Month</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{currentMonthPayments.length}</p>
          <p className="text-sm text-gray-500 mt-1">Payment records</p>
        </div>
      </div>

      {/* Payment Records */}
      {payments.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Payment Records</h3>
          <p className="text-gray-500 mb-6">
            Payment history will appear here once you have students enrolled.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(paymentsByStudent).map(([studentName, studentPayments]) => (
            <div key={studentName} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-blue-600 p-4">
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <DollarSign size={20} />
                  <span>{studentName}</span>
                </h3>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {studentPayments
                    .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
                    .map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {getPaymentMethodDisplay(payment.payment_method)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {formatMonth(payment.month)}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {payment.payment_date 
                              ? `Paid on ${formatDate(payment.payment_date)}`
                              : 'Payment pending'
                            }
                          </p>
                          {payment.notes && (
                            <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-800">
                            {formatAmount(payment.amount)}
                          </p>
                          {payment.payment_method && (
                            <p className="text-xs text-gray-500 capitalize">
                              {payment.payment_method.replace('_', ' ')}
                            </p>
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPaymentStatusColor(payment.paid)}`}>
                          {payment.paid ? 'Paid' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {studentPayments.length === 0 && (
                  <div className="text-center py-6">
                    <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-gray-500">No payment records for this student</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;