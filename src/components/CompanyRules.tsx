import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  TrendingUp, 
  Award, 
  Download, 
  Printer, 
  CheckCircle2, 
  HelpCircle, 
  MapPin, 
  FileText, 
  Flame, 
  Zap, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface CompanyRulesProps {
  onRaiseNotification?: (title: string, message: string, type: 'info' | 'warning' | 'alert' | 'success') => void;
}

export default function CompanyRules({ onRaiseNotification }: CompanyRulesProps) {
  const [activeTab, setActiveTab] = useState<'halfday' | 'overtime' | 'punch'>('halfday');

  // Rules policies content for download
  const policyDocuments = {
    halfday: {
      title: "Half Day & Attendance Sizing Policy",
      lastUpdated: "May 2026",
      summary: "Standard working hours, grace period allowances, penalty check-ins, early sign-outs, and absent criteria definitions.",
      rules: [
        {
          title: "45-Minute Grace Period",
          details: "Employees have a grace window of up to 45 minutes from their automatically detected Shift Start time to punch in. Any check-in within this timeframe yields a Full Day present, provided minimum exit criteria are also met."
        },
        {
          title: "Late Arrival Penalty (Half Day)",
          details: "Punching in after the 45-minute grace period automatically flags the attendance as a 'Half Day'. (e.g., Logging in after 09:45 AM for General Shift)."
        },
        {
          title: "Early Check-out Restriction (Half Day)",
          details: "Checking out more than 60 minutes before the official Shift End time automatically downgrades the attendance status from a Full Day to a 'Half Day'. (e.g., Leaving earlier than 05:00 PM for General Shift)."
        },
        {
          title: "Minimum Duration Check (Absenteeism)",
          details: "If the total active duty time is less than 3 hours, the system registers the record as 'Absent' (0 hours, 0 wages) to ensure high physical attendance standards."
        }
      ],
      hindiRules: [
        {
          title: "45-मिनट ग्रेस पीरियड नियम",
          details: "कर्मचारियों को उनकी ऑटो-डिटेक्ट की गई शिफ्ट शुरू होने के समय से पंच-इन करने के लिए 45 मिनट तक का ग्रेस टाइम (छूट अवधि) मिलता है। इस समय सीमा के भीतर चेक-इन करने पर पूरे दिन (Full Day) की उपस्थिति मानी जाएगी।"
        },
        {
          title: "देरी से आने पर दंड (हाफ डे)",
          details: "45 मिनट की ग्रेस अवधि के बाद चेक-इन करने पर अटेंडेंस को स्वचालित रूप से 'हाफ डे' (आधा दिन) के रूप में चिह्नित किया जाएगा। (जैसे: जनरल शिफ्ट के लिए सुबह 09:45 बजे के बाद लॉगिन करने पर)।"
        },
        {
          title: "जल्दी जाने पर हाफ डे प्रतिबंध",
          details: "आधिकारिक शिफ्ट समाप्ति समय से 60 मिनट से पहले पंच-आउट करने पर उपस्थिति स्थिति स्वतः पूरे दिन से घटकर 'हाफ डे' हो जाएगी। (जैसे: जनरल शिफ्ट के लिए शाम 05:00 बजे से पहले निकल जाना)।"
        },
        {
          title: "न्यूनतम कार्य अवधि नियम (अनुपस्थिति)",
          details: "यदि कुल ड्यूटी का समय 3 घंटे से कम पाया जाता है, तो अटेंडेंस स्वतः 'अनुपस्थित' (Absent - 0 घंटे, 0 वेतन) दर्ज की जाएगी ताकि कार्य अनुशासन बना रहे।"
        }
      ],
      romanHindiRules: [
        {
          title: "45-Minute Grace Period Niyam",
          details: "Employees ke paas shift shuru hone ke 45 minutes ke andar punch-in karne ki chhoot hai. Is samay ke andar login karne par pure din (Full Day) ki attendance mani jayegi."
        },
        {
          title: "Late Arrival Penalty (Half Day)",
          details: "Shift shuru hone ke 45 minutes ke baad check-in karne par dynamic 'Half Day' status lag jayega. (Jaise: General Shift me 09:45 AM ke baad check-in karne par)."
        },
        {
          title: "Early Check-out Restriction (Half Day)",
          details: "Shift khatam hone ke 60 minutes se pehle punch-out karne par automatic 'Half Day' status lag jayega. Kaam samay se pehle adhura chodne par ye penalty manya hai."
        },
        {
          title: "Minimum Duration Check (Absenteeism)",
          details: "Agar kul duty ka samay 3 ghante se kam paaya jata hai, toh automatic present status badal kar 'Absent' lag jata hai aur wage 0 ho jayegi."
        }
      ]
    },
    overtime: {
      title: "Overtime (OT) Qualification & Calculation Policy",
      lastUpdated: "May 2026",
      summary: "Eligible manufacturing units, standard hourly rates, shift rollover parameters, and strict timing round-downs.",
      rules: [
        {
          title: "Eligible Work Locations",
          details: "OT is exclusively logged and calculated for designated locations: Hetero Palashbari, Hetero Changsari, Natco Pharma, and Ajanta/Anajta Pharma. Other sites do not generate OT entitlements."
        },
        {
          title: "Completed Hours Principle",
          details: "Overtime is calculated on a completed hour basis. Any excess minutes worked after the official shift end time must complete a full 60-minute interval to be credited. Incomplete hourly fractions are ignored."
        },
        {
          title: "The Math Formula",
          details: "Formula: Overtime (Hours) = Floor(Total Extra Minutes after Shift End / 60). High precision mapping occurs automatically: 55 minutes extra = 0 hrs OT; 70 minutes extra = 1 hr OT."
        },
        {
          title: "OT Compensation Multipliers",
          details: "Payment is based on the Employee's configured Hourly Wage Rate. OT Wages = OT Hours × Hourly Wage Rate (added above current salary)."
        }
      ],
      hindiRules: [
        {
          title: "ओटी (OT) के योग्य स्थान",
          details: "ओवरटाइम विशेष रूप से केवल चिह्नित स्थानों पर ही मान्य है: हेटेरो पलाशबाड़ी, हेटेरो चांगसारी, नैटको फार्मा, और अजंता फार्मा। अन्य कार्यस्थलों पर ओवरटाइम देय नहीं होगा।"
        },
        {
          title: "पूर्ण घंटे का सिद्धांत (घंटे का नियम)",
          details: "ओवरटाइम की गणना केवल पूरे हुए घंटों के आधार पर की जाती है। शिफ्ट समय के बाद अतिरिक्त कार्य कम से कम 60 मिनट पूरा होना चाहिए। 60 मिनट से कम के अतिरिक्त समय की गणना नहीं की जाएगी।"
        },
        {
          title: "ओवरटाइम गणना सूत्र",
          details: "फ़ॉर्मूला: ओवरटाइम (घंटे) = Floor(शिफ्ट के बाद कुल अतिरिक्त मिनट / 60)। उदाहरण के लिए: 59 अतिरिक्त मिनट = 0 घंटे ओटी; 60 अतिरिक्त मिनट = 1 घंटा ओटी।"
        },
        {
          title: "ओवरटाइम मुआवजा दर",
          details: "ओवरटाइम भुगतान कर्मचारी के निर्धारित प्रति घंटा वेतन दर (Hourly Wage Rate) के गुणांक के रूप में सीधे मासिक वेतन में जोड़ा जाएगा।"
        }
      ],
      romanHindiRules: [
        {
          title: "OT Eligible Locations",
          details: "Overtime sirf chune huye sites par valid hai: Hetero Palashbari, Hetero Changsari, Natco Pharma, aur Ajanta Pharma. Baki sites par overtime zero count hoga."
        },
        {
          title: "Completed Hours Principle (Ghanto Ka Niyam)",
          details: "Extra kaam hamesha pure ghanto me hi count kiya jata hai. Adhe ghante ya dakhila fraction minutes ko ignore kiya jata hai."
        },
        {
          title: "Hisab Ka Formula",
          details: "Formula: Overtime = Floor(Extra Minutes / 60). Jaise, agar employee ne shift ke baad 59 minute extra kaam kiya, toh OT 0 hoga. Agar 60 ya upar kaam kiya, tabhi 1 ghanta badega."
        },
        {
          title: "OT Wage Rate",
          details: "Overtime payment employee ke profile me likhe gaye standard 'Hourly Wage' (Rs) ke hisab se automatic calculation kiya jata hai."
        }
      ]
    },
    punch: {
      title: "Smart System Punch & Active Shift Detection Policy",
      lastUpdated: "May 2026",
      summary: "Automatic Shift allocation parameters according to first morning check-in time windows.",
      rules: [
        {
          title: "No Manual Select Obligation",
          details: "To eliminate errors, manual shift assignment has been completely removed from Employee Profiles. Shift is detected dynamically."
        },
        {
          title: "A Shift Timing Window (07:00 AM – 03:00 PM)",
          details: "System auto-assigns 'A Shift' if the first login punch occurs between 05:00 AM and 08:00 AM."
        },
        {
          title: "General Shift Timing Window (09:00 AM – 06:00 PM)",
          details: "System auto-assigns standard 'General Shift' if the login punch occurs between 08:01 AM and 11:30 AM."
        },
        {
          title: "B Shift Timing Window (02:00 PM – 11:00 PM)",
          details: "System auto-assigns 'B Shift' if the login punch occurs between 11:31 AM and 06:00 PM."
        },
        {
          title: "C Shift Timing Window (11:00 PM – 07:00 AM)",
          details: "System auto-assigns 'C Shift' (Night Shift) if the login punch falls in the late-hours window (06:01 PM to 04:59 AM)."
        }
      ],
      hindiRules: [
        {
          title: "स्वचालित शिफ्ट आवंटन नियम",
          details: "मानवीय भूलों को रोकने के लिए, कर्मचारी प्रोफाइल से मैन्युअल रूप से शिफ्ट असाइन करने का विकल्प हटा दिया गया है। आपकी पहली पंच-इन प्रविष्टि के आधार पर कंप्यूटर स्वतः शिफ्ट निर्धारित करता है।"
        },
        {
          title: "A शिफ्ट समय सीमा (सुबह 07:00 - दोपहर 03:00)",
          details: "यदि आपकी पहली पंच-इन एंट्री सुबह 05:00 बजे से लेकर सुबह 08:00 बजे के बीच दर्ज होती है, तो सिस्टम कर्मचारी को स्वतः 'A शिफ्ट' में मैप कर देता है।"
        },
        {
          title: "जनरल शिफ्ट समय सीमा (सुबह 09:00 - शाम 06:00)",
          details: "यदि आपकी पहली पंच-इन एंट्री सुबह 08:01 बजे से दोपहर 11:30 बजे के बीच होती है, तो आप स्वचालित रूप से 'जनरल शिफ्ट' के अंतर्गत माने जाएंगे।"
        },
        {
          title: "B शिफ्ट समय सीमा (दोपहर 02:00 - रात 11:00)",
          details: "यदि आपकी पहली पंच-इन एंट्री दोपहर 11:31 बजे से लेकर शाम 06:00 बजे के बीच आती है, तो सिस्टम स्वतः कर्मचारी को 'B शिफ्ट' आवंटित करता है।"
        },
        {
          title: "C शिफ्ट / नाइट शिफ्ट (रात 11:00 - सुबह 07:00)",
          details: "शाम 06:01 बजे से लेकर अगली सुबह 04:59 बजे के देर-रात अंतराल में पंच-इन करने पर कर्मचारी को स्वतः 'C शिफ्ट' (नाइट शिफ्ट) आवंटित की जाती है।"
        }
      ],
      romanHindiRules: [
        {
          title: "Shift Assign Karne Se Mukti",
          details: "Profiles me se assigned shift choose karne ka option hata diya gaya hai. Ab aapke punch-in samay se computer khud shift nirdharit karta hai."
        },
        {
          title: "A Shift (07:00 AM - 03:00 PM)",
          details: "Subah 05:00 AM se lekar 08:00 AM ke dauran login karne par employee auto 'A Shift' me mana jayega."
        },
        {
          title: "General Shift (09:00 AM - 06:00 PM)",
          details: "Subah 08:01 AM se lekar dopahar 11:30 AM ke dauran login karne par aap auto 'General Shift' me assigned honge."
        },
        {
          title: "B Shift (02:00 PM - 11:00 PM)",
          details: "Dopahar 11:31 AM se shaam 06:00 PM ke beech login karne par direct 'B Shift' me mapping hogi."
        },
        {
          title: "C Shift / Night Shift (11:00 PM - 07:00 AM)",
          details: "Shaam 06:01 PM se agle din subah 04:59 AM ke beech kisi bhi entry par auto 'C Shift' lagadi jayegi."
        }
      ]
    }
  };

  const currentPolicy = policyDocuments[activeTab];

  // Helper function to download policy PDF file
  const handleDownload = () => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      // Colors
      const primaryColor = [15, 23, 42]; // #0f172a Deep Slate
      const accentColor = [79, 70, 229];  // #4f46e5 Accent Indigo
      const textColor = [51, 65, 85];      // #334155 Slate Grey
      const lightBg = [248, 250, 252];    // #f8fafc

      // Header Banner Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 38, 'F');

      // Decorative Graphic Accent
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(15, 11, 4, 16, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text("CALITECH ENGINEERING SOLUTIONS", 24, 17);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text("SYSTEM REGULATORY COMPLIANCE DIRECTIVES BOOK", 24, 23);

      // Period / Date text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`LAST DECREE: ${currentPolicy.lastUpdated.toUpperCase()}`, 195, 17, { align: 'right' });
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`DOWNLOAD DATE: ${new Date().toLocaleDateString().toUpperCase()}`, 195, 23, { align: 'right' });

      let cursorY = 48;

      // Title & Overview
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13.5);
      doc.text(currentPolicy.title, 15, cursorY);
      cursorY += 5;

      // Thin Accent Bar below title
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(15, cursorY, 25, 1, 'F');
      cursorY += 8;

      // Policy Summary Box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, cursorY, 180, 16, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, cursorY, 180, 16, 'D');

      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text("POLICY SCOPE & AUDITING MANDATE:", 19, cursorY + 5.5);
      
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      
      // Wrap paragraph to fit
      const splitSummary = doc.splitTextToSize(currentPolicy.summary, 172);
      doc.text(splitSummary, 19, cursorY + 10.5);
      cursorY += 23;

      // 1. English Section Header
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("1. WORKFORCE DIRECTIVES (ENGLISH)", 15, cursorY);
      cursorY += 2;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, cursorY, 195, cursorY);
      cursorY += 5;

      // Render English rules listing
      currentPolicy.rules.forEach((rule, idx) => {
        if (cursorY > 265) {
          doc.addPage();
          cursorY = 25;
        }

        // Bullet number indicator
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(15, cursorY - 3, 4.5, 4.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(String(idx + 1), 17.25, cursorY + 0.3, { align: 'center' });

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(rule.title, 22, cursorY + 0.5);
        cursorY += 4.5;

        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        const wrappedDetails = doc.splitTextToSize(rule.details, 170);
        doc.text(wrappedDetails, 22, cursorY);
        cursorY += (wrappedDetails.length * 3.5) + 4.5;
      });

      // Space spacer prior to Hindi Translate
      cursorY += 2;

      // 2. Hindi Section Header
      if (cursorY > 250) {
        doc.addPage();
        cursorY = 25;
      }
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("2. ROMAN HINDI POLICIES (ROMAN HINDI LAYOUT)", 15, cursorY);
      cursorY += 2;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, cursorY, 195, cursorY);
      cursorY += 5;

      // Render Hindi rules listing
      currentPolicy.romanHindiRules.forEach((rule, idx) => {
        if (cursorY > 265) {
          doc.addPage();
          cursorY = 25;
        }

        // Bullet number indicator
        doc.setFillColor(15, 23, 42); // Black Slate
        doc.rect(15, cursorY - 3, 4.5, 4.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(String(idx + 1), 17.25, cursorY + 0.3, { align: 'center' });

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(rule.title, 22, cursorY + 0.5);
        cursorY += 4.5;

        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        const wrappedDetails = doc.splitTextToSize(rule.details, 170);
        doc.text(wrappedDetails, 22, cursorY);
        cursorY += (wrappedDetails.length * 3.5) + 4.5;
      });

      // Footer disclaimer & Certification Seal at the bottom
      if (cursorY > 255) {
        doc.addPage();
        cursorY = 25;
      } else {
        cursorY = Math.max(cursorY + 3, 258);
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(15, cursorY, 195, cursorY);
      
      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text("CALITECH ENGINEERING WORKFORCE REGULATIONS & ISO-9001 SYSTEM REGULATORY LOGS", 15, cursorY + 4.5);
      doc.text("ALL REGISTERED PUNCH INTERVALS FROM CORRESPONDING PORTAL STATIONS SYNC ON-DEMAND ACCORDING TO THIS COMPLIANCE DECREE.", 15, cursorY + 8);

      // Save PDF
      doc.save(`${activeTab}_policy_rule_${new Date().toISOString().split('T')[0]}.pdf`);

      if (onRaiseNotification) {
        onRaiseNotification("Policy Downloaded", `Successfully downloaded ${currentPolicy.title} PDF report!`, 'success');
      }
    } catch (error) {
      console.error("PDF generation failed, falling back to TXT", error);
      // Fallback text download
      let textContent = `=======================================================\n`;
      textContent += `OFFICIAL HR COMPLIANCE POLICY - ${currentPolicy.title.toUpperCase()}\n`;
      textContent += `Last Updated: ${currentPolicy.lastUpdated} | Calitech Workforce Node\n`;
      textContent += `=======================================================\n\n`;
      textContent += `SUMMARY:\n${currentPolicy.summary}\n\n`;
      
      textContent += `-------------------------------------------------------\n`;
      textContent += `ENGLISH RULES & SPECIFICATIONS\n`;
      textContent += `-------------------------------------------------------\n`;
      currentPolicy.rules.forEach((rule, idx) => {
        textContent += `${idx + 1}. ${rule.title}\n   ${rule.details}\n\n`;
      });

      textContent += `-------------------------------------------------------\n`;
      textContent += `HINDI RULES & REGULATIONS (हिन्दी नियम एवं निर्देश)\n`;
      textContent += `-------------------------------------------------------\n`;
      currentPolicy.hindiRules.forEach((rule, idx) => {
        textContent += `${idx + 1}. ${rule.title}\n   ${rule.details}\n\n`;
      });

      textContent += `=======================================================\n`;
      textContent += `Generated on ${new Date().toLocaleDateString()} for HR Workforce Audit Records.\n`;

      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab}_policy_rule_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Helper trigger to print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="company-rules-view" className="space-y-6 select-none max-w-6xl mx-auto p-4 md:p-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1e293b] to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldAlert className="w-48 h-48 text-indigo-400 rotate-12" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/25 border border-indigo-400/30 px-3 py-1 rounded-full text-indigo-300 text-[10.5px] uppercase font-mono font-bold tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Driven Kiosk Compliance</span>
          </div>
          <h1 className="text-2xl md:text-3.5xl font-sans font-black tracking-tight text-white mb-2">
            Company Rules & Guidelines
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Configure, inspect, and evaluate dynamic shift assignments, hours calculations, 45-minute late-coming penalties, and overtime parameters.
          </p>
        </div>
      </div>

      {/* Main Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Buttons */}
        <div className="lg:col-span-3 flex flex-col space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#475569] font-mono px-3 mb-1">
            Browse Guidelines
          </p>
          
          <button
            id="tab-btn-halfday"
            onClick={() => setActiveTab('halfday')}
            className={`w-full text-left px-4 py-3.5 rounded-2xl flex items-center space-x-3 border transition-all duration-250 cursor-pointer ${
              activeTab === 'halfday'
                ? 'bg-indigo-600 border-indigo-550 text-white shadow-md shadow-indigo-600/10'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'halfday' ? 'text-indigo-200' : 'text-slate-400'}`} />
            <div>
              <span className="text-xs font-extrabold block">Half Day Rules</span>
              <span className={`text-[10px] block font-medium ${activeTab === 'halfday' ? 'text-indigo-200' : 'text-slate-400'}`}>
                Late entry & Early exits
              </span>
            </div>
          </button>

          <button
            id="tab-btn-overtime"
            onClick={() => setActiveTab('overtime')}
            className={`w-full text-left px-4 py-3.5 rounded-2xl flex items-center space-x-3 border transition-all duration-250 cursor-pointer ${
              activeTab === 'overtime'
                ? 'bg-indigo-600 border-indigo-550 text-white shadow-md shadow-indigo-600/10'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${activeTab === 'overtime' ? 'text-indigo-200' : 'text-slate-400'}`} />
            <div>
              <span className="text-xs font-extrabold block">Overtime (OT) Rules</span>
              <span className={`text-[10px] block font-medium ${activeTab === 'overtime' ? 'text-indigo-200' : 'text-slate-400'}`}>
                Eligible location math
              </span>
            </div>
          </button>

          <button
            id="tab-btn-punch"
            onClick={() => setActiveTab('punch')}
            className={`w-full text-left px-4 py-3.5 rounded-2xl flex items-center space-x-3 border transition-all duration-250 cursor-pointer ${
              activeTab === 'punch'
                ? 'bg-indigo-600 border-indigo-550 text-white shadow-md shadow-indigo-600/10'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Zap className={`w-4 h-4 ${activeTab === 'punch' ? 'text-indigo-200' : 'text-slate-400'}`} />
            <div>
              <span className="text-xs font-extrabold block">Auto-Shift Detection</span>
              <span className={`text-[10px] block font-medium ${activeTab === 'punch' ? 'text-indigo-200' : 'text-slate-400'}`}>
                Punch window detection
              </span>
            </div>
          </button>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-4 space-y-3">
            <div className="flex items-center space-x-2 text-indigo-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Live Engine Status</span>
            </div>
            <p className="text-[11px] text-slate-655 leading-relaxed">
              These rules represent the compiled backend logic executing in 
              <strong> /src/utils/calculations.ts</strong>. Calculations on reporting modules synchronize natively with this policy.
            </p>
          </div>
        </div>

        {/* Right Side Cards */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Policy Document Card */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden print:border-none print:shadow-none">
            
            {/* Header portion */}
            <div className="border-b border-slate-100 p-5 md:p-6 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-extrabold text-slate-900">
                    {currentPolicy.title}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    HR Regulatory Directive &bull; Last Revised {currentPolicy.lastUpdated}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 print:hidden">
                <button
                  id="download-policy-btn"
                  onClick={handleDownload}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-indigo-600/10 hover:shadow-md text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer border border-indigo-550 shadow-sm"
                >
                  <Download className="w-4 h-4 text-indigo-100" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Content portion */}
            <div className="p-6 space-y-6 md:p-8">
              
              {/* Summary disclaimer box */}
              <div className="p-4 bg-[#f8fafc] border-l-4 border-slate-700 rounded-r-2xl select-all font-mono text-[11px] text-slate-650 leading-relaxed">
                <strong className="text-slate-900 block font-sans uppercase font-bold tracking-wider text-[10px] mb-1">
                  Policy Scope & Target:
                </strong>
                {currentPolicy.summary}
              </div>

              {/* Grid block for english & hindi rules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                
                {/* English rules column */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 mb-3">
                    <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider font-mono">
                      English Regulatory Directives
                    </h3>
                  </div>

                  {currentPolicy.rules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-neutral-50 transition-colors">
                      <div className="flex items-start space-x-2.5">
                        <div className="w-5 h-5 bg-indigo-100/80 text-indigo-700 text-[10px] font-black rounded-full flex items-center justify-center shrink-0 mt-0.5 font-mono">
                          {idx + 1}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900">
                            {rule.title}
                          </h4>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                            {rule.details}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hindi rules column */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-indigo-100/50 pb-2 mb-3">
                    <span className="w-1.5 h-3 bg-indigo-500 rounded-full"></span>
                    <h3 className="text-xs font-bold uppercase text-indigo-900 tracking-wider font-hindi">
                      आधिकारिक हिन्दी मार्गदर्शिका (Hindi Translation)
                    </h3>
                  </div>

                  {currentPolicy.hindiRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-indigo-50/20 border border-indigo-50 rounded-2xl hover:bg-indigo-50/30 transition-colors">
                      <div className="flex items-start space-x-2.5">
                        <div className="w-5.5 h-5.5 bg-indigo-200/50 text-indigo-850 text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5 font-sans">
                          {idx + 1}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[13.5px] font-bold text-slate-950 font-hindi leading-snug">
                            {rule.title}
                          </h4>
                          <p className="text-[12px] text-slate-700 leading-relaxed font-hindi">
                            {rule.details}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Footer warning stamp */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <div className="flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Authorized Calitech Stamp Active</span>
              </div>
              <span className="hidden sm:inline">System: ISO-9001-Compliant</span>
            </div>

          </div>

          {/* Quick FAQ info/Bento block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-3xs flex items-start space-x-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mt-0.5 shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-slate-900">Attendance Sync</h4>
                <p className="text-[10px] text-slate-550 leading-normal">
                  All dynamically evaluated states are instantly synchronized with Google Sheets.
                </p>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-3xs flex items-start space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mt-0.5 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-slate-900">Geofencing Active</h4>
                <p className="text-[10px] text-slate-550 leading-normal">
                  Proximity checks are enforced at designated operational headquarters prior to entry approvals.
                </p>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-3xs flex items-start space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mt-0.5 shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-slate-900">Custom Adjustments</h4>
                <p className="text-[10px] text-slate-550 leading-normal">
                  In case of punches occurring outside operational guidelines, manual shifts can be overridden by admins.
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
