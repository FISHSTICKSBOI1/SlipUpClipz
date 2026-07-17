import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ChangelogPage } from './pages/ChangelogPage'
import { ContactPage } from './pages/ContactPage'
import { DownloadPage } from './pages/DownloadPage'
import { FaqPage } from './pages/FaqPage'
import { FeaturesPage } from './pages/FeaturesPage'
import { HelpArticlePage } from './pages/HelpArticlePage'
import { HelpPage } from './pages/HelpPage'
import { HomePage } from './pages/HomePage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { RefundPage } from './pages/RefundPage'
import { TermsPage } from './pages/TermsPage'
import { SITE } from './config/site'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path={SITE.paths.home} element={<HomePage />} />
        <Route path={SITE.paths.features} element={<FeaturesPage />} />
        <Route path={SITE.paths.howItWorks} element={<HowItWorksPage />} />
        <Route path={SITE.paths.pricing} element={<PricingPage />} />
        <Route path={SITE.paths.download} element={<DownloadPage />} />
        <Route path={SITE.paths.help} element={<HelpPage />} />
        <Route path={`${SITE.paths.help}/:slug`} element={<HelpArticlePage />} />
        <Route path={SITE.paths.contact} element={<ContactPage />} />
        <Route path={SITE.paths.faq} element={<FaqPage />} />
        <Route path={SITE.paths.changelog} element={<ChangelogPage />} />
        <Route path={SITE.paths.privacy} element={<PrivacyPage />} />
        <Route path={SITE.paths.terms} element={<TermsPage />} />
        <Route path={SITE.paths.refund} element={<RefundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
