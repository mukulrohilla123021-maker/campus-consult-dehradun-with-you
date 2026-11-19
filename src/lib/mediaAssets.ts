import dehradunMarketCoverImg from '../assets/images/dehradun_market_cover_1794978259475.jpg';
import howItWorksWorkflowImg from '../assets/images/how_it_works_workflow_1794998876446.jpg';
import serviceAccountingImg from '../assets/images/service_accounting_1794998871518.jpg';
import serviceConsultingImg from '../assets/images/service_consulting_1794998875504.jpg';
import serviceDataAnalyticsImg from '../assets/images/service_data_analytics_1794998873375.jpg';
import serviceDigitalMarketingImg from '../assets/images/service_digital_marketing_1794998873508.jpg';
import serviceDocumentationImg from '../assets/images/service_documentation_1794998874261.jpg';
import serviceExcelMisImg from '../assets/images/service_excel_mis_1794998871895.jpg';
import serviceFinancialAnalysisImg from '../assets/images/service_financial_analysis_1794998871003.jpg';
import serviceGraphicDesignImg from '../assets/images/service_graphic_design_1794998873930.jpg';
import serviceInventoryImg from '../assets/images/service_inventory_1794998873068.jpg';
import serviceMarketResearchImg from '../assets/images/service_market_research_1794998875341.jpg';
import serviceSalesBdImg from '../assets/images/service_sales_bd_1794998876049.jpg';
import serviceSocialMediaImg from '../assets/images/service_social_media_1794998873245.jpg';
import studentShopkeeperConsultingImg from '../assets/images/student_shopkeeper_consulting_1794978260387.jpg';
import teamCollaborationAboutImg from '../assets/images/team_collaboration_about_1794998876176.jpg';

export const HERO_CONSULTING_IMG = studentShopkeeperConsultingImg;
export const DEHRADUN_MARKET_IMG = dehradunMarketCoverImg;
export const ABOUT_TEAM_IMG = teamCollaborationAboutImg;
export const HOW_WORKFLOW_IMG = howItWorksWorkflowImg;

const BUNDLED_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/dehradun_market_cover_1794978259475.jpg': dehradunMarketCoverImg,
  '/src/assets/images/how_it_works_workflow_1794998876446.jpg': howItWorksWorkflowImg,
  '/src/assets/images/service_accounting_1794998871518.jpg': serviceAccountingImg,
  '/src/assets/images/service_consulting_1794998875504.jpg': serviceConsultingImg,
  '/src/assets/images/service_data_analytics_1794998873375.jpg': serviceDataAnalyticsImg,
  '/src/assets/images/service_digital_marketing_1794998873508.jpg': serviceDigitalMarketingImg,
  '/src/assets/images/service_documentation_1794998874261.jpg': serviceDocumentationImg,
  '/src/assets/images/service_excel_mis_1794998871895.jpg': serviceExcelMisImg,
  '/src/assets/images/service_financial_analysis_1794998871003.jpg': serviceFinancialAnalysisImg,
  '/src/assets/images/service_graphic_design_1794998873930.jpg': serviceGraphicDesignImg,
  '/src/assets/images/service_inventory_1794998873068.jpg': serviceInventoryImg,
  '/src/assets/images/service_market_research_1794998875341.jpg': serviceMarketResearchImg,
  '/src/assets/images/service_sales_bd_1794998876049.jpg': serviceSalesBdImg,
  '/src/assets/images/service_social_media_1794998873245.jpg': serviceSocialMediaImg,
  '/src/assets/images/student_shopkeeper_consulting_1794978260387.jpg': studentShopkeeperConsultingImg,
  '/src/assets/images/team_collaboration_about_1794998876176.jpg': teamCollaborationAboutImg,
};

const SLUG_TO_ASSET: Record<string, string> = {
  'accounting-bookkeeping': serviceAccountingImg,
  'financial-statement-preparation': serviceFinancialAnalysisImg,
  'financial-modelling': serviceFinancialAnalysisImg,
  'financial-analysis': serviceFinancialAnalysisImg,
  'excel-mis-reporting': serviceExcelMisImg,
  'data-analytics': serviceDataAnalyticsImg,
  'inventory-management': serviceInventoryImg,
  'business-research': serviceMarketResearchImg,
  'digital-marketing': serviceDigitalMarketingImg,
  'social-media-management': serviceSocialMediaImg,
  'graphic-design': serviceGraphicDesignImg,
  'business-documentation': serviceDocumentationImg,
  'business-consulting': serviceConsultingImg,
  'presentation-design': serviceGraphicDesignImg,
  'market-research': serviceMarketResearchImg,
  'sales-business-development': serviceSalesBdImg,
};

export const BUNDLED_IMAGE_PRESETS = [
  { label: 'Accounting & Bookkeeping', value: '/src/assets/images/service_accounting_1794998871518.jpg' },
  { label: 'Financial Analysis & Modelling', value: '/src/assets/images/service_financial_analysis_1794998871003.jpg' },
  { label: 'Excel & MIS Reporting', value: '/src/assets/images/service_excel_mis_1794998871895.jpg' },
  { label: 'Inventory Management', value: '/src/assets/images/service_inventory_1794998873068.jpg' },
  { label: 'Data Analytics', value: '/src/assets/images/service_data_analytics_1794998873375.jpg' },
  { label: 'Digital Marketing', value: '/src/assets/images/service_digital_marketing_1794998873508.jpg' },
  { label: 'Social Media Management', value: '/src/assets/images/service_social_media_1794998873245.jpg' },
  { label: 'Graphic & Presentation Design', value: '/src/assets/images/service_graphic_design_1794998873930.jpg' },
  { label: 'Business Documentation', value: '/src/assets/images/service_documentation_1794998874261.jpg' },
  { label: 'Market & Business Research', value: '/src/assets/images/service_market_research_1794998875341.jpg' },
  { label: 'Business Consulting', value: '/src/assets/images/service_consulting_1794998875504.jpg' },
  { label: 'Sales & Business Development', value: '/src/assets/images/service_sales_bd_1794998876049.jpg' },
];

export function resolveAssetReference(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (BUNDLED_ASSET_MAP[trimmed]) return BUNDLED_ASSET_MAP[trimmed];
  return trimmed;
}

export function resolveCategoryFallbackImage(slugOrName?: string | null): string {
  const key = String(slugOrName || '')
    .trim()
    .toLowerCase();
  if (SLUG_TO_ASSET[key]) return SLUG_TO_ASSET[key];
  if (key.includes('account') || key.includes('bookkeep')) return serviceAccountingImg;
  if (key.includes('financ')) return serviceFinancialAnalysisImg;
  if (key.includes('excel') || key.includes('mis')) return serviceExcelMisImg;
  if (key.includes('invent')) return serviceInventoryImg;
  if (key.includes('data') || key.includes('analytic')) return serviceDataAnalyticsImg;
  if (key.includes('digital') || key.includes('seo')) return serviceDigitalMarketingImg;
  if (key.includes('social')) return serviceSocialMediaImg;
  if (key.includes('graphic') || key.includes('present') || key.includes('design')) return serviceGraphicDesignImg;
  if (key.includes('doc')) return serviceDocumentationImg;
  if (key.includes('research') || key.includes('market')) return serviceMarketResearchImg;
  if (key.includes('sales') || key.includes('business development')) return serviceSalesBdImg;
  return serviceConsultingImg;
}

export function resolveCategoryImage(imageUrl?: string | null, slugOrName?: string | null): string {
  const direct = resolveAssetReference(imageUrl);
  if (direct) return direct;
  return resolveCategoryFallbackImage(slugOrName);
}

export function resolveServiceImage(
  imageUrl?: string | null,
  categoryImageUrl?: string | null,
  categorySlugOrName?: string | null
): string {
  const direct = resolveAssetReference(imageUrl);
  if (direct) return direct;
  const catDirect = resolveAssetReference(categoryImageUrl);
  if (catDirect) return catDirect;
  return resolveCategoryFallbackImage(categorySlugOrName);
}
