import { createContext, useContext, useState } from "react";

export const translations = {
  en: {
    // Navbar
    nav_home: "Home",
    nav_complaint: "Submit Complaint",
    nav_dashboard: "Admin Dashboard",
    nav_subtitle: "Citizen Complaints & Management System",

    // Home Page
    home_hero_badge: "AI-Powered Civic Platform",
    home_hero_title: "Report. Track. Resolve.",
    home_hero_subtitle:
      "Submit citizen complaints for floods, road damage, garbage, power failures, and street lights. Our AI system prioritizes and dispatches issues instantly.",
    home_report_btn: "Report an Issue",
    home_dashboard_btn: "View Dashboard",
    home_categories_title: "Issue Categories",
    home_how_title: "How It Works",
    home_step1_title: "Submit Your Report",
    home_step1_desc: "Fill in the complaint form with details and optional GPS location.",
    home_step2_title: "AI Analysis",
    home_step2_desc: "Our AI model assesses severity and prioritizes the issue automatically.",
    home_step3_title: "Field Dispatch",
    home_step3_desc: "Relevant municipal teams are notified and dispatched to resolve the issue.",
    home_stats_complaints: "Complaints Handled",
    home_stats_response: "Avg Response Time",
    home_stats_resolved: "Issues Resolved",
    home_stats_districts: "Districts Covered",

    // Category labels
    cat_flood: "Flood & Drainage",
    cat_road: "Road Damage",
    cat_garbage: "Garbage & Waste",
    cat_power: "Power Failure",
    cat_light: "Street Lights",

    // Complaint Form
    form_title: "Submit a Complaint",
    form_subtitle: "Report a civic issue in your area",
    form_category_label: "Issue Category",
    form_name_label: "Full Name",
    form_name_placeholder: "e.g. Kamal Perera",
    form_phone_label: "Phone Number",
    form_phone_placeholder: "e.g. 077 123 4567",
    form_description_label: "Describe the Issue",
    form_description_placeholder: "Provide as much detail as possible about the issue...",
    form_location_label: "Location",
    form_location_btn: "Auto-Detect Location (GPS)",
    form_location_detecting: "Detecting location...",
    form_district_label: "District",
    form_district_placeholder: "e.g. Colombo",
    form_city_label: "City / Town",
    form_city_placeholder: "e.g. Kaduwela",
    form_area_label: "Area / Street",
    form_area_placeholder: "e.g. Main Street, Ward 3",
    form_photo_label: "Upload Photo (Optional)",
    form_photo_hint: "Supported: JPG, PNG, WEBP (max 10MB)",
    form_submit_btn: "Submit Complaint",
    form_submitting: "Submitting...",
    form_success_title: "Complaint Submitted!",
    form_success_tracking: "Tracking ID",
    form_success_msg: "Your complaint has been registered and our team has been notified.",
    form_success_redirect: "Redirecting to Home Page in",
    form_success_redirect_s: "seconds...",
    form_success_go_home: "Go to Home Page Now →",
    form_location_optional: "Location is optional — you can type it manually below.",

    // Dashboard
    dash_title: "Municipal Admin Dashboard",
    dash_subtitle: "Real-time triage and field dispatch overview for citizen complaints.",
    dash_total: "TOTAL COMPLAINTS",
    dash_critical: "CRITICAL / HIGH RISK",
    dash_active: "Active",
    dash_cases: "Cases",
    dash_breakdown: "Issue Breakdown by Category",
    dash_logs: "Recent Incident Logs",
    dash_showing: "Showing",
    dash_reports: "report(s) sorted by submission time",
    dash_clear_filter: "Clear Filter (Show All)",
    dash_no_data: "No complaints found for this category.",
    dash_col_id: "TRACKING ID",
    dash_col_citizen: "CITIZEN",
    dash_col_category: "CATEGORY",
    dash_col_location: "LOCATION",
    dash_col_severity: "SEVERITY",
    dash_col_status: "STATUS",
    dash_col_submitted: "SUBMITTED",
    dash_filter_active: "Filter Active ✓",
    dash_click_filter: "Click to filter",
    dash_pending_ai: "⏳ Pending AI",
  },
  si: {
    // Navbar
    nav_home: "මුල් පිටුව",
    nav_complaint: "පැමිණිල්ල ඉදිරිපත් කරන්න",
    nav_dashboard: "පරිපාලක උපකරණ පුවරුව",
    nav_subtitle: "පුරවැසි පැමිණිලි සහ කළමනාකරණ පද්ධතිය",

    // Home Page
    home_hero_badge: "AI-පාදක සිවිල් වේදිකාව",
    home_hero_title: "වාර්තා කරන්න. ගමන් කරන්න. විසඳන්න.",
    home_hero_subtitle:
      "ගංවතුර, මාර්ග හානි, කසළ, විදුලි බිඳ වැටීම් සහ වීදි ලාම්පු සඳහා පැමිණිලි ඉදිරිපත් කරන්න. අපගේ AI පද්ධතිය ගැටළු ප්‍රමුඛතා ලෙස සලකා ක්ෂණිකව යොමු කරයි.",
    home_report_btn: "ගැටළුවක් වාර්තා කරන්න",
    home_dashboard_btn: "උපකරණ පුවරුව බලන්න",
    home_categories_title: "ගැටළු වර්ග",
    home_how_title: "ක්‍රියා කරන ආකාරය",
    home_step1_title: "ඔබේ වාර්තාව ඉදිරිපත් කරන්න",
    home_step1_desc: "GPS ස්ථානය සහ තොරතුරු සමඟ පැමිණිලි පෝරමය පුරවන්න.",
    home_step2_title: "AI විශ්ලේෂණය",
    home_step2_desc: "අපගේ AI ආකෘතිය ස්වයංක්‍රීයව බරපතලකම ඇගයීම් කරයි.",
    home_step3_title: "ක්ෂේත්‍ර යොමු කිරීම",
    home_step3_desc: "අදාළ නාගරික කණ්ඩායම් දැනුම් දී ගැටළුව විසඳීමට යොමු කරනු ලැබේ.",
    home_stats_complaints: "හැසිරවූ පැමිණිලි",
    home_stats_response: "සාම. ප්‍රතිචාර කාලය",
    home_stats_resolved: "විසඳූ ගැටළු",
    home_stats_districts: "ආවරණය වූ දිස්ත්‍රික්ක",

    // Category labels
    cat_flood: "ගංවතුර සහ ජල බැස්සීම",
    cat_road: "මාර්ග හානි",
    cat_garbage: "කසළ සහ අපද්‍රව්‍ය",
    cat_power: "විදුලි බිඳ වැටීම",
    cat_light: "වීදි ලාම්පු",

    // Complaint Form
    form_title: "පැමිණිල්ල ඉදිරිපත් කරන්න",
    form_subtitle: "ඔබේ ප්‍රදේශයේ ගැටළුවක් වාර්තා කරන්න",
    form_category_label: "ගැටළු වර්ගය",
    form_name_label: "සම්පූර්ණ නම",
    form_name_placeholder: "උදා: කමල් පෙරේරා",
    form_phone_label: "දුරකථන අංකය",
    form_phone_placeholder: "උදා: 077 123 4567",
    form_description_label: "ගැටළුව විස්තර කරන්න",
    form_description_placeholder: "ගැටළුව පිළිබඳ හැකිතාක් විස්තර සඳහන් කරන්න...",
    form_location_label: "ස්ථානය",
    form_location_btn: "ස්වයං-GPS ස්ථාන හඳුනාගැනීම",
    form_location_detecting: "ස්ථානය හඳුනාගනිමින්...",
    form_district_label: "දිස්ත්‍රික්කය",
    form_district_placeholder: "උදා: කොළඹ",
    form_city_label: "නගරය",
    form_city_placeholder: "උදා: කදුවෙල",
    form_area_label: "ප්‍රදේශය / වීදිය",
    form_area_placeholder: "උදා: ප්‍රධාන වීදිය, 3 වැනි නාය",
    form_photo_label: "ඡායාරූපය උඩුගත කරන්න (අමතරව)",
    form_photo_hint: "JPG, PNG, WEBP සඳහා සහාය (උපරිම 10MB)",
    form_submit_btn: "පැමිණිල්ල ඉදිරිපත් කරන්න",
    form_submitting: "ඉදිරිපත් කරමින්...",
    form_success_title: "පැමිණිල්ල ඉදිරිපත් කරන ලදී!",
    form_success_tracking: "නිරීක්ෂණ ID",
    form_success_msg: "ඔබේ පැමිණිල්ල ලියාපදිංචි කර අපගේ කණ්ඩායමට දැනුම් දී ඇත.",
    form_success_redirect: "මුල් පිටුවට යොමු කෙරේ",
    form_success_redirect_s: "තත්පරවලින්...",
    form_success_go_home: "දැන් මුල් පිටුවට යන්න →",
    form_location_optional: "ස්ථානය අනිවාර්ය නොවේ — ඔබට පහතින් අතින් ටයිප් කළ හැකිය.",

    // Dashboard
    dash_title: "නාගරික පරිපාලක උපකරණ පුවරුව",
    dash_subtitle: "පුරවැසි පැමිණිලි සඳහා තාත්කාලික ත්‍රිආජ් සහ ක්ෂේත්‍ර යොමු දළ විශ්ලේෂණය.",
    dash_total: "මුළු පැමිණිලි",
    dash_critical: "තීරණාත්මක / ඉහළ අවදානම",
    dash_active: "සක්‍රිය",
    dash_cases: "නඩු",
    dash_breakdown: "වර්ගය අනුව ගැටළු බෙදීම",
    dash_logs: "මෑත සිදුවීම් ලොග",
    dash_showing: "පෙන්වීම",
    dash_reports: "ඉදිරිපත් කිරීමේ වේලාව අනුව වාර්තා",
    dash_clear_filter: "පෙරහන ඉවත් කරන්න",
    dash_no_data: "මෙම වර්ගය සඳහා පැමිණිලි නොමැත.",
    dash_col_id: "නිරීක්ෂණ ID",
    dash_col_citizen: "පුරවැසියා",
    dash_col_category: "වර්ගය",
    dash_col_location: "ස්ථානය",
    dash_col_severity: "බරපතලකම",
    dash_col_status: "තත්ත්වය",
    dash_col_submitted: "ඉදිරිපත් කළේ",
    dash_filter_active: "පෙරහන සක්‍රිය ✓",
    dash_click_filter: "පෙරහනට ක්ලික් කරන්න",
    dash_pending_ai: "⏳ AI විශ්ලේෂණය",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("cp_lang") || "en";
  });

  const switchLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem("cp_lang", newLang);
  };

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
