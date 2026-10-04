'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Plane,
  Shield,
  FileText,
  Upload,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Chrome,
  HelpCircle,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Lock,
  Layers,
  Edit3,
  AlertTriangle,
} from 'lucide-react';

interface Guide {
  id: string;
  title: string;
  readTime: string;
  description: string;
  content: string[];
}

const GUIDES: Guide[] = [
  {
    id: 'how-it-works',
    title: 'How Visa Autofill Works',
    readTime: '3 min read',
    description: 'An overview of how the Visa Autofill browser extension pairs with the official Indian visa portal.',
    content: [
      'Visa Autofill acts as your client-side assistant. It extracts applicant information from scanned passport documents and populates form fields on the official portal automatically.',
      'The process begins by signing in with your Google account. Your identity is matched between the web application and the Chrome Extension for a unified experience.',
      'When you open the Indian visa portal in Chrome, the extension identifies active input fields (such as Given Name, Surname, Passport Number, and Date of Birth) and populates them using your saved applicant records.',
      'Crucially, Visa Autofill never submits forms automatically. You retain complete visibility and control over every field before progressing to the next page.',
    ],
  },
  {
    id: 'passport-pdf-prep',
    title: 'How to Prepare Your Passport PDF',
    readTime: '4 min read',
    description: 'Best practices for scanning and uploading clear passport copies for accurate OCR parsing.',
    content: [
      'High-quality passport scans are vital for accurate character recognition. Ensure your scan includes the entire biographical page without cut-off borders.',
      'Avoid harsh glare, flash reflections, or shadows covering the Machine Readable Zone (MRZ) - the two lines of chevrons (<<<) at the bottom of the passport page.',
      'Save your document in standard PDF format with a file size under 10MB. Color scans at 300 DPI resolution yield the highest extraction confidence.',
      'If your passport contains handwritten annotations or unusual fonts, review the extracted data carefully using the manual edit tools before saving.',
    ],
  },
  {
    id: 'review-extracted-info',
    title: 'How to Review Extracted Information',
    readTime: '3 min read',
    description: 'Essential verification checkpoints to review before injecting data into official government forms.',
    content: [
      'After the OCR engine completes document extraction, you are presented with an organized summary of all parsed fields.',
      'Check 1: Verify that your Given Name and Surname are placed in their respective fields matching the MRZ formatting.',
      'Check 2: Confirm your Date of Birth, Passport Issue Date, and Expiry Date follow the standard DD/MM/YYYY format.',
      'Check 3: Inspect your Passport Number for easily confused characters (such as the letter "O" vs the digit "0", or letter "I" vs digit "1").',
      'You can freely edit, correct, or supplement any field directly in the application editor before finalizing.',
    ],
  },
  {
    id: 'portal-autofill-guide',
    title: 'Using Autofill on the Indian Visa Application',
    readTime: '5 min read',
    description: 'Step-by-step guidance on navigating portal sections, handling CAPTCHAs, and managing draft IDs.',
    content: [
      'Once your applicant profile is prepared, navigate to the official Indian visa application website (indianvisaonline.gov.in).',
      'Click the Visa Autofill Chrome Extension icon from your browser toolbar. Select the applicant profile you wish to apply with.',
      'Click "Autofill Page". The extension will automatically find matching inputs and populate them with your verified data.',
      'Manual Step Required: You must manually solve the CAPTCHA image and click "Save and Continue". For your security, CAPTCHA challenges are never automated.',
      'Make note of the Temporary Application ID provided by the government portal on step 2 so you can resume your draft at any time.',
    ],
  },
];

export default function HomePublicPage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGuide, setActiveGuide] = useState<Guide | null>(null);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);

  // If authenticated user is an ADMIN, MANAGER, or SUPER_ADMIN, redirect to /dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && user?.role && user.role !== 'USER') {
      router.replace('/dashboard');
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* ======================================================== */}
      {/* 1. NAVBAR */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/home" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Plane className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Visa Autofill
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Assistant
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#hero" className="hover:text-blue-600 transition-colors">
              Home
            </a>
            <a href="#why-autofill" className="hover:text-blue-600 transition-colors">
              Why Visa Autofill
            </a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="#features" className="hover:text-blue-600 transition-colors">
              Features
            </a>
            <a href="#guides" className="hover:text-blue-600 transition-colors">
              Guides
            </a>
          </nav>

          {/* Right Side: Auth State */}
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {user.role !== 'USER' ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Open Dashboard</span>
                  </Link>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>User Account</span>
                  </div>
                )}

                <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-800 max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <button
                    onClick={() => logout()}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition-colors"
              >
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
            <a
              href="#hero"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
            >
              Home
            </a>
            <a
              href="#why-autofill"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
            >
              Why Visa Autofill
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
            >
              How It Works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
            >
              Features
            </a>
            <a
              href="#guides"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
            >
              Guides
            </a>

            <div className="pt-4 border-t border-slate-100">
              {isAuthenticated && user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-9 h-9 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">{user.name}</p>
                      <p className="text-[11px] text-slate-500">{user.email}</p>
                    </div>
                  </div>

                  {user.role !== 'USER' ? (
                    <Link
                      href="/dashboard"
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold bg-blue-600 text-white rounded-xl"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Open Dashboard</span>
                    </Link>
                  ) : null}

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold bg-blue-600 text-white rounded-xl shadow-xs"
                >
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ======================================================== */}
      {/* 2. HERO SECTION */}
      {/* ======================================================== */}
      <section id="hero" className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Smart Visa Application Assistant</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Visa Autofill
          </h1>

          <p className="mt-4 text-xl sm:text-2xl font-semibold text-slate-700 max-w-3xl mx-auto">
            Fill your Indian visa application faster and with fewer manual steps.
          </p>

          <p className="mt-4 text-sm sm:text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Extract passport data automatically from your PDF scan, review and edit every field with confidence, and autofill official application forms via our dedicated Chrome Extension.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setExtensionModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-colors"
            >
              <Chrome className="w-4 h-4" />
              <span>Open Visa Autofill Extension</span>
            </button>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 shadow-xs transition-colors"
            >
              <span>Learn How It Works</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Quick trust metrics */}
          <div className="mt-12 pt-8 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fast Setup</p>
              <p className="text-sm font-bold text-slate-900 mt-1">Direct Secure Sign-In</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Control</p>
              <p className="text-sm font-bold text-slate-900 mt-1">100% Manual Review</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zero-Trust</p>
              <p className="text-sm font-bold text-slate-900 mt-1">Encrypted Sessions</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compliance</p>
              <p className="text-sm font-bold text-slate-900 mt-1">Manual CAPTCHA & OTP</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. WHY VISA AUTOFILL? (KEY EXTENSION INFO) */}
      {/* ======================================================== */}
      <section id="why-autofill" className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Comprehensive Workflow
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
              Why Visa Autofill?
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Designed specifically to take the friction and human error out of multi-page visa forms while maintaining full safety standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Upload Passport PDF</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Provide your standard scanned passport PDF document directly into the extension for immediate processing.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Extract Passport Information</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Machine-readable zone (MRZ) and biographical fields are converted into structured digital application records.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Edit3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Review & Edit Manually</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Inspect every extracted surname, date, and document number before anything is transferred to government portals.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Save Applicant Information</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Applicant profiles are stored under your verified Google account so you never have to re-enter data repeatedly.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Autofill Supported Fields</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                One-click field injection directly into the active Indian visa application portal forms across steps 1 through 4.
              </p>
            </div>

            <div className="p-6 bg-amber-50/80 rounded-2xl border border-amber-200/80">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-amber-900">Manual CAPTCHA & OTP Steps</h3>
              <p className="text-xs text-amber-800 mt-2 leading-relaxed">
                Important: In full compliance with government security, CAPTCHA verification, OTP codes, payments, and submission remain manual.
              </p>
            </div>
          </div>

          {/* Compliance & Security Callout */}
          <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Security & Compliance Guarantee:</strong> Visa Autofill does not attempt to automate security challenges (CAPTCHA), bypass two-factor SMS/email OTP confirmations, or handle financial transactions. You maintain 100% manual review over official submissions.
            </span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. HOW IT WORKS (4 SIMPLE STEPS) */}
      {/* ======================================================== */}
      <section id="how-it-works" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Step-by-Step
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
              How It Works
            </p>
            <p className="mt-3 text-sm text-slate-500">
              A straightforward 4-step workflow that turns physical passport scans into auto-filled portal forms.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-4">
                1
              </span>
              <h3 className="text-base font-bold text-slate-900">Sign In</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Connect using your Google account to create a safe, synchronized workspace for your applicant records.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-4">
                2
              </span>
              <h3 className="text-base font-bold text-slate-900">Upload Passport PDF</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Provide a clear digital scan of the applicant’s passport biographical page directly in the extension.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-4">
                3
              </span>
              <h3 className="text-base font-bold text-slate-900">Review & Save</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Inspect extracted names, dates, and passport numbers. Make any manual corrections with full edit freedom.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-4">
                4
              </span>
              <h3 className="text-base font-bold text-slate-900">Autofill Visa Application</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Open the official visa portal and click Autofill to populate inputs instantly across each application step.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. FEATURES */}
      {/* ======================================================== */}
      <section id="features" className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Core Capabilities
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Precision & Speed
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Clean features focused strictly on accuracy and saving valuable time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Passport Data Extraction</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Accurately reads Machine Readable Zone (MRZ) patterns and standard biographical fields from PDF uploads.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Smart Application Fields</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Maps extracted values directly to the official government form schema, eliminating mismatched inputs.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Saved Applications</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Store multiple applicant records securely under your account for easy reuse on family or group travel.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Fast Autofill</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Populates dozens of complex form fields in seconds with a single click from the Chrome toolbar.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Manual Review</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Full edit interface ensures you can inspect, verify, and correct every piece of data before portal entry.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Secure Account</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Protected by Google OAuth token validation, zero-trust credential architecture, and role-based permissions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. LATEST GUIDES */}
      {/* ======================================================== */}
      <section id="guides" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Knowledge Base
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
              Latest Guides
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Essential tips and walkthroughs to help you prepare your visa paperwork smoothly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {GUIDES.map((guide) => (
              <div
                key={guide.id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-bold uppercase tracking-wider text-blue-600">Guide</span>
                    <span>{guide.readTime}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{guide.title}</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {guide.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveGuide(guide)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <BookOpen className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. EXTENSION CTA */}
      {/* ======================================================== */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Chrome className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready to simplify your visa application?
          </h2>

          <p className="mt-3 text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
            Extract passport records accurately, eliminate manual data re-entry, and autofill official Indian visa forms in minutes.
          </p>

          <div className="mt-8">
            <button
              onClick={() => setExtensionModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-blue-600 font-bold text-sm hover:bg-blue-50 shadow-lg shadow-blue-900/20 transition-colors"
            >
              <Chrome className="w-4 h-4" />
              <span>Use Visa Autofill Extension</span>
            </button>
            <p className="mt-3 text-xs text-blue-200">
              Chrome Extension available separately.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 8. FOOTER */}
      {/* ======================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Plane className="w-4 h-4 -rotate-45" />
              </div>
              <span className="text-white font-bold text-base">Visa Autofill</span>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-400">
              <a href="#hero" className="hover:text-white transition-colors">
                Home
              </a>
              <a href="#how-it-works" className="hover:text-white transition-colors">
                How It Works
              </a>
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#guides" className="hover:text-white transition-colors">
                Guides
              </a>
              <Link href="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500">
              &copy; {new Date().getFullYear()} Visa Autofill. All rights reserved.
            </p>
            <p className="text-slate-500 text-center md:text-right max-w-md">
              Disclaimer: Visa Autofill is an independent productivity assistant tool. It is not affiliated with, authorized by, or endorsed by the Government of India or the official visa portal.
            </p>
          </div>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* GUIDE DETAILS MODAL */}
      {/* ======================================================== */}
      {activeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto relative">
            <button
              onClick={() => setActiveGuide(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              {activeGuide.readTime}
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1">
              {activeGuide.title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 pb-4 border-b border-slate-100">
              {activeGuide.description}
            </p>

            <div className="mt-5 space-y-3.5 text-xs text-slate-600 leading-relaxed">
              {activeGuide.content.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveGuide(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EXTENSION INFO MODAL */}
      {/* ======================================================== */}
      {extensionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative text-center">
            <button
              onClick={() => setExtensionModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Chrome className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Visa Autofill Chrome Extension
            </h3>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              The Visa Autofill Chrome Extension is your companion in the browser that connects with this account to parse passport PDFs and fill forms on the Indian visa portal.
            </p>

            <div className="mt-5 p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 text-left space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Installed directly into Google Chrome</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Uses the same Google account for authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Safe client-side form filling</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4">
              Chrome Extension available separately.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {!isAuthenticated ? (
                <Link
                  href="/login"
                  className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  Sign In to Connect Your Account
                </Link>
              ) : (
                <button
                  onClick={() => setExtensionModalOpen(false)}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Got It
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
