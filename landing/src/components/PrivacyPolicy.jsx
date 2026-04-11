import { useEffect } from 'react'

const EMAIL = 'contactus@joinbridgeapp.com'
const DSAR_URL = 'https://app.termly.io/dsar/99c0b03c-e30a-4a48-a94a-62a2c0d3febc'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Sub({ title, children }) {
  return (
    <div className="mb-5">
      {title && <h3 className="text-base font-semibold text-white/80 mb-2">{title}</h3>}
      {children}
    </div>
  )
}

function P({ children }) {
  return <p className="text-sm text-white/55 leading-relaxed mb-3">{children}</p>
}

function Li({ children }) {
  return (
    <li className="text-sm text-white/55 leading-relaxed mb-1 pl-1">
      {children}
    </li>
  )
}

function A({ href, children }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="text-scarlet hover:text-scarlet/80 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  )
}

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="bg-ink min-h-screen pt-20 pb-24">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-display text-white tracking-widest uppercase mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-white/35">Last updated April 11, 2026</p>
        </div>

        {/* Intro */}
        <div className="mb-10">
          <P>
            This Privacy Notice for <strong className="text-white/70">Bridge</strong> ("we," "us," or "our") describes
            how and why we might access, collect, store, use, and/or share ("process") your personal
            information when you use our services ("Services"), including when you:
          </P>
          <ul className="list-disc list-inside mb-4 space-y-1 pl-2">
            <Li>
              Visit our website at{' '}
              <A href="https://joinbridgeapp.com">https://joinbridgeapp.com</A>, or any website of
              ours that links to this Privacy Notice
            </Li>
            <Li>Engage with us in other related ways, including any marketing or events</Li>
          </ul>
          <P>
            <strong className="text-white/70">Questions or concerns?</strong> Reading this Privacy
            Notice will help you understand your privacy rights and choices. We are responsible for
            making decisions about how your personal information is processed. If you do not agree
            with our policies and practices, please do not use our Services. If you still have any
            questions or concerns, please contact us at{' '}
            <A href={`mailto:${EMAIL}`}>{EMAIL}</A>.
          </P>
        </div>

        {/* Summary */}
        <Section id="summary" title="Summary of Key Points">
          <P>
            <em>
              This summary provides key points from our Privacy Notice, but you can find out more
              details by using the{' '}
              <A href="#toc">table of contents</A> below.
            </em>
          </P>
          <ul className="space-y-3 mt-4">
            <Li>
              <strong className="text-white/70">What personal information do we process?</strong>{' '}
              When you visit, use, or navigate our Services, we may process personal information
              depending on how you interact with us. Learn more about{' '}
              <A href="#infocollect">personal information you disclose to us</A>.
            </Li>
            <Li>
              <strong className="text-white/70">Do we process any sensitive personal information?</strong>{' '}
              We do not process sensitive personal information.
            </Li>
            <Li>
              <strong className="text-white/70">Do we collect any information from third parties?</strong>{' '}
              We do not collect any information from third parties.
            </Li>
            <Li>
              <strong className="text-white/70">How do we process your information?</strong>{' '}
              We process your information to provide, improve, and administer our Services,
              communicate with you, for security and fraud prevention, and to comply with law. Learn
              more about <A href="#infouse">how we process your information</A>.
            </Li>
            <Li>
              <strong className="text-white/70">In what situations and with which parties do we share personal information?</strong>{' '}
              We may share information in specific situations and with specific categories of third
              parties. Learn more about{' '}
              <A href="#whoshare">when and with whom we share your personal information</A>.
            </Li>
            <Li>
              <strong className="text-white/70">How do we keep your information safe?</strong>{' '}
              We have adequate organizational and technical processes in place. However, no
              electronic transmission can be guaranteed 100% secure. Learn more about{' '}
              <A href="#infosafe">how we keep your information safe</A>.
            </Li>
            <Li>
              <strong className="text-white/70">What are your rights?</strong>{' '}
              Depending on where you are located, you may have certain rights regarding your
              personal information. Learn more about{' '}
              <A href="#privacyrights">your privacy rights</A>.
            </Li>
            <Li>
              <strong className="text-white/70">How do you exercise your rights?</strong>{' '}
              The easiest way is by submitting a{' '}
              <A href={DSAR_URL}>data subject access request</A>, or by contacting us. We will
              consider and act upon any request in accordance with applicable data protection laws.
            </Li>
          </ul>
        </Section>

        {/* TOC */}
        <Section id="toc" title="Table of Contents">
          <ol className="space-y-1.5">
            {[
              ['#infocollect', '1. What Information Do We Collect?'],
              ['#infouse', '2. How Do We Process Your Information?'],
              ['#whoshare', '3. When and With Whom Do We Share Your Personal Information?'],
              ['#inforetain', '4. How Long Do We Keep Your Information?'],
              ['#infosafe', '5. How Do We Keep Your Information Safe?'],
              ['#infominors', '6. Do We Collect Information From Minors?'],
              ['#privacyrights', '7. What Are Your Privacy Rights?'],
              ['#DNT', '8. Controls for Do-Not-Track Features'],
              ['#uslaws', '9. Do United States Residents Have Specific Privacy Rights?'],
              ['#policyupdates', '10. Do We Make Updates to This Notice?'],
              ['#contact', '11. How Can You Contact Us About This Notice?'],
              ['#request', '12. How Can You Review, Update, or Delete the Data We Collect From You?'],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-sm text-scarlet hover:text-scarlet/80 underline underline-offset-2 transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </Section>

        {/* 1. What information */}
        <Section id="infocollect" title="1. What Information Do We Collect?">
          <Sub title="Personal information you disclose to us">
            <P>
              <em>
                <strong>In Short:</strong> We collect personal information that you provide to us.
              </em>
            </P>
            <P>
              We collect personal information that you voluntarily provide to us when you express an
              interest in obtaining information about us or our products and Services, when you
              participate in activities on the Services, or otherwise when you contact us.
            </P>
            <P>
              <strong className="text-white/70">Personal Information Provided by You.</strong> The
              personal information we collect may include: email addresses.
            </P>
            <P>
              <strong className="text-white/70">Sensitive Information.</strong> We do not process
              sensitive information.
            </P>
            <P>
              All personal information that you provide to us must be true, complete, and accurate,
              and you must notify us of any changes to such personal information.
            </P>
          </Sub>
        </Section>

        {/* 2. How we process */}
        <Section id="infouse" title="2. How Do We Process Your Information?">
          <P>
            <em>
              <strong>In Short:</strong> We process your information to provide, improve, and
              administer our Services, communicate with you, for security and fraud prevention, and
              to comply with law. We may also process your information for other purposes with your
              consent.
            </em>
          </P>
          <P>
            <strong className="text-white/70">
              We process your personal information for a variety of reasons, depending on how you
              interact with our Services, including:
            </strong>
          </P>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <Li>
              <strong className="text-white/70">To deliver and facilitate delivery of services to the user.</strong>{' '}
              We may process your information to provide you with the requested service.
            </Li>
            <Li>
              <strong className="text-white/70">To send you marketing and promotional communications.</strong>{' '}
              We may process the personal information you send to us for our marketing purposes, if
              this is in accordance with your marketing preferences. You can opt out of our
              marketing emails at any time. See{' '}
              <A href="#privacyrights">What Are Your Privacy Rights?</A> below.
            </Li>
            <Li>
              <strong className="text-white/70">To deliver targeted advertising to you.</strong>{' '}
              We may process your information to develop and display personalized content and
              advertising tailored to your interests, location, and more.
            </Li>
            <Li>
              <strong className="text-white/70">To determine the effectiveness of our marketing and promotional campaigns.</strong>{' '}
              We may process your information to better understand how to provide marketing and
              promotional campaigns that are most relevant to you.
            </Li>
          </ul>
        </Section>

        {/* 3. When/with whom we share */}
        <Section id="whoshare" title="3. When and With Whom Do We Share Your Personal Information?">
          <P>
            <em>
              <strong>In Short:</strong> We may share information in specific situations described
              in this section and/or with the following categories of third parties.
            </em>
          </P>
          <P>
            <strong className="text-white/70">Vendors, Consultants, and Other Third-Party Service Providers.</strong>{' '}
            We may share your data with third-party vendors, service providers, contractors, or
            agents ("third parties") who perform services for us or on our behalf and require access
            to such information to do that work.
          </P>
          <P>The categories of third parties we may share personal information with are as follows:</P>
          <ul className="list-disc list-inside space-y-1 pl-2 mb-4">
            <Li>Data Analytics Services</Li>
            <Li>Data Storage Service Providers</Li>
          </ul>
          <P>We also may need to share your personal information in the following situations:</P>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <Li>
              <strong className="text-white/70">Business Transfers.</strong> We may share or
              transfer your information in connection with, or during negotiations of, any merger,
              sale of company assets, financing, or acquisition of all or a portion of our business
              to another company.
            </Li>
            <Li>
              <strong className="text-white/70">Business Partners.</strong> We may share your
              information with our business partners to offer you certain products, services, or
              promotions.
            </Li>
          </ul>
        </Section>

        {/* 4. How long */}
        <Section id="inforetain" title="4. How Long Do We Keep Your Information?">
          <P>
            <em>
              <strong>In Short:</strong> We keep your information for as long as necessary to
              fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.
            </em>
          </P>
          <P>
            We will only keep your personal information for as long as it is necessary for the
            purposes set out in this Privacy Notice, unless a longer retention period is required or
            permitted by law (such as tax, accounting, or other legal requirements).
          </P>
          <P>
            When we have no ongoing legitimate business need to process your personal information,
            we will either delete or anonymize such information, or, if this is not possible (for
            example, because your personal information has been stored in backup archives), then we
            will securely store your personal information and isolate it from any further processing
            until deletion is possible.
          </P>
        </Section>

        {/* 5. How safe */}
        <Section id="infosafe" title="5. How Do We Keep Your Information Safe?">
          <P>
            <em>
              <strong>In Short:</strong> We aim to protect your personal information through a
              system of organizational and technical security measures.
            </em>
          </P>
          <P>
            We have implemented appropriate and reasonable technical and organizational security
            measures designed to protect the security of any personal information we process.
            However, despite our safeguards and efforts to secure your information, no electronic
            transmission over the Internet or information storage technology can be guaranteed to be
            100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other
            unauthorized third parties will not be able to defeat our security and improperly
            collect, access, steal, or modify your information. Although we will do our best to
            protect your personal information, transmission of personal information to and from our
            Services is at your own risk. You should only access the Services within a secure
            environment.
          </P>
        </Section>

        {/* 6. Minors */}
        <Section id="infominors" title="6. Do We Collect Information From Minors?">
          <P>
            <em>
              <strong>In Short:</strong> We do not knowingly collect data from or market to
              children under 18 years of age.
            </em>
          </P>
          <P>
            We do not knowingly collect, solicit data from, or market to children under 18 years of
            age, nor do we knowingly sell such personal information. By using the Services, you
            represent that you are at least 18 or that you are the parent or guardian of such a
            minor and consent to such minor dependent's use of the Services. If we learn that
            personal information from users less than 18 years of age has been collected, we will
            deactivate the account and take reasonable measures to promptly delete such data from
            our records. If you become aware of any data we may have collected from children under
            age 18, please contact us at <A href={`mailto:${EMAIL}`}>{EMAIL}</A>.
          </P>
        </Section>

        {/* 7. Privacy rights */}
        <Section id="privacyrights" title="7. What Are Your Privacy Rights?">
          <P>
            <em>
              <strong>In Short:</strong> You may review, change, or terminate your account at any
              time, depending on your country, province, or state of residence.
            </em>
          </P>
          <Sub title="Withdrawing your consent">
            <P>
              If we are relying on your consent to process your personal information, you have the
              right to withdraw your consent at any time. You can withdraw your consent at any time
              by contacting us using the contact details provided in the section{' '}
              <A href="#contact">How Can You Contact Us About This Notice?</A> below.
            </P>
            <P>
              However, please note that this will not affect the lawfulness of the processing before
              its withdrawal nor, when applicable law allows, will it affect the processing of your
              personal information conducted in reliance on lawful processing grounds other than
              consent.
            </P>
          </Sub>
          <Sub title="Opting out of marketing and promotional communications">
            <P>
              You can unsubscribe from our marketing and promotional communications at any time by
              contacting us using the details provided in the section{' '}
              <A href="#contact">How Can You Contact Us About This Notice?</A> below. You will then
              be removed from the marketing lists. However, we may still communicate with you — for
              example, to send you service-related messages that are necessary for the
              administration and use of your account.
            </P>
          </Sub>
          <P>
            If you have questions or comments about your privacy rights, you may email us at{' '}
            <A href={`mailto:${EMAIL}`}>{EMAIL}</A>.
          </P>
        </Section>

        {/* 8. DNT */}
        <Section id="DNT" title="8. Controls for Do-Not-Track Features">
          <P>
            Most web browsers and some mobile operating systems and mobile applications include a
            Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy
            preference not to have data about your online browsing activities monitored and
            collected. At this stage, no uniform technology standard for recognizing and
            implementing DNT signals has been finalized. As such, we do not currently respond to
            DNT browser signals or any other mechanism that automatically communicates your choice
            not to be tracked online. If a standard for online tracking is adopted that we must
            follow in the future, we will inform you about that practice in a revised version of
            this Privacy Notice.
          </P>
          <P>
            California law requires us to let you know how we respond to web browser DNT signals.
            Because there currently is not an industry or legal standard for recognizing or honoring
            DNT signals, we do not respond to them at this time.
          </P>
        </Section>

        {/* 9. US laws */}
        <Section id="uslaws" title="9. Do United States Residents Have Specific Privacy Rights?">
          <P>
            <em>
              <strong>In Short:</strong> If you are a resident of California, Colorado, Connecticut,
              Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska,
              New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, or Virginia,
              you may have the right to request access to and receive details about the personal
              information we maintain about you and how we have processed it, correct inaccuracies,
              get a copy of, or delete your personal information. You may also have the right to
              withdraw your consent to our processing of your personal information. These rights may
              be limited in some circumstances by applicable law. More information is provided below.
            </em>
          </P>
          <Sub title="Categories of Personal Information We Collect">
            <P>
              The table below shows the categories of personal information we have collected in the
              past twelve (12) months. For a comprehensive inventory of all personal information we
              process, please refer to the section{' '}
              <A href="#infocollect">What Information Do We Collect?</A>
            </P>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse border border-white/15">
                <thead>
                  <tr className="bg-white/5">
                    <th className="border border-white/15 px-4 py-2 text-left text-white/60 font-semibold">Category</th>
                    <th className="border border-white/15 px-4 py-2 text-left text-white/60 font-semibold">Examples</th>
                    <th className="border border-white/15 px-4 py-2 text-left text-white/60 font-semibold">Collected</th>
                  </tr>
                </thead>
                <tbody className="text-white/45">
                  {[
                    ['A. Identifiers', 'Contact details, such as real name, alias, postal address, telephone or mobile contact number, unique personal identifier, online identifier, Internet Protocol address, email address, and account name', 'YES'],
                    ['B. Personal information as defined in the California Customer Records statute', 'Name, contact information, education, employment, employment history, and financial information', 'NO'],
                    ['C. Protected classification characteristics under state or federal law', 'Gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data', 'NO'],
                    ['D. Commercial information', 'Transaction information, purchase history, financial details, and payment information', 'NO'],
                    ['E. Biometric information', 'Fingerprints and voiceprints', 'NO'],
                    ['F. Internet or other similar network activity', 'Browsing history, search history, online behavior, interest data, and interactions with our and other websites', 'NO'],
                    ['G. Geolocation data', 'Device location', 'NO'],
                    ['H. Audio, electronic, sensory, or similar information', 'Images and audio, video or call recordings created in connection with our business activities', 'NO'],
                    ['I. Professional or employment-related information', 'Business contact details in order to provide you our Services at a business level or job title, work history, and professional qualifications if you apply for a job with us', 'NO'],
                    ['J. Education Information', 'Student records and directory information', 'NO'],
                    ['K. Inferences drawn from collected personal information', 'Inferences drawn from any of the collected personal information listed above to create a profile or summary about an individual', 'NO'],
                    ['L. Sensitive personal information', '', 'NO'],
                  ].map(([cat, ex, col]) => (
                    <tr key={cat}>
                      <td className="border border-white/15 px-4 py-2 align-top">{cat}</td>
                      <td className="border border-white/15 px-4 py-2 align-top">{ex}</td>
                      <td className="border border-white/15 px-4 py-2 align-top font-medium text-white/70">{col}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P className="mt-4">
              We will use and retain the collected personal information as needed to provide the
              Services or for: Category A — Indefinitely.
            </P>
          </Sub>
          <Sub title="Sources of Personal Information">
            <P>
              Learn more about the sources of personal information we collect in{' '}
              <A href="#infocollect">What Information Do We Collect?</A>
            </P>
          </Sub>
          <Sub title="How We Use and Share Personal Information">
            <P>
              Learn more about how we use your personal information in the section{' '}
              <A href="#infouse">How Do We Process Your Information?</A>
            </P>
            <P>
              <strong className="text-white/70">Will your information be shared with anyone else?</strong>
            </P>
            <P>
              We may disclose your personal information with our service providers pursuant to a
              written contract between us and each service provider. Learn more about how we
              disclose personal information in the section{' '}
              <A href="#whoshare">When and With Whom Do We Share Your Personal Information?</A>
            </P>
            <P>
              We may use your personal information for our own business purposes, such as for
              undertaking internal research for technological development and demonstration. This is
              not considered to be "selling" of your personal information.
            </P>
            <P>
              We have not sold or shared any personal information to third parties for a business or
              commercial purpose in the preceding twelve (12) months. We have disclosed the
              following categories of personal information to third parties for a business or
              commercial purpose in the preceding twelve (12) months: none.
            </P>
            <P>
              The categories of third parties to whom we disclosed personal information for a
              business or commercial purpose can be found under{' '}
              <A href="#whoshare">When and With Whom Do We Share Your Personal Information?</A>
            </P>
          </Sub>
          <Sub title="Your Rights">
            <P>
              You have rights under certain US state data protection laws. However, these rights are
              not absolute, and in certain cases, we may decline your request as permitted by law.
              These rights include:
            </P>
            <ul className="list-disc list-inside space-y-1.5 pl-2 mb-4">
              <Li><strong className="text-white/70">Right to know</strong> whether or not we are processing your personal data</Li>
              <Li><strong className="text-white/70">Right to access</strong> your personal data</Li>
              <Li><strong className="text-white/70">Right to correct</strong> inaccuracies in your personal data</Li>
              <Li><strong className="text-white/70">Right to request</strong> the deletion of your personal data</Li>
              <Li><strong className="text-white/70">Right to obtain a copy</strong> of the personal data you previously shared with us</Li>
              <Li><strong className="text-white/70">Right to non-discrimination</strong> for exercising your rights</Li>
              <Li><strong className="text-white/70">Right to opt out</strong> of the processing of your personal data if it is used for targeted advertising, the sale of personal data, or profiling in furtherance of decisions that produce legal or similarly significant effects ("profiling")</Li>
            </ul>
            <P>
              Depending upon the state where you live, you may also have the following rights:
            </P>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <Li>Right to access the categories of personal data being processed (as permitted by applicable law, including the privacy law in Minnesota)</Li>
              <Li>Right to obtain a list of the categories of third parties to which we have disclosed personal data (as permitted by applicable law, including the privacy law in California, Delaware, and Maryland)</Li>
              <Li>Right to obtain a list of specific third parties to which we have disclosed personal data (as permitted by applicable law, including the privacy law in Minnesota and Oregon)</Li>
              <Li>Right to obtain a list of third parties to which we have sold personal data (as permitted by applicable law, including the privacy law in Connecticut)</Li>
              <Li>Right to review, understand, question, and depending on where you live, correct how personal data has been profiled (as permitted by applicable law, including the privacy law in Connecticut and Minnesota)</Li>
              <Li>Right to limit use and disclosure of sensitive personal data (as permitted by applicable law, including the privacy law in California)</Li>
              <Li>Right to opt out of the collection of sensitive data and personal data collected through the operation of a voice or facial recognition feature (as permitted by applicable law, including the privacy law in Florida)</Li>
            </ul>
          </Sub>
          <Sub title="How to Exercise Your Rights">
            <P>
              To exercise these rights, you can contact us by submitting a{' '}
              <A href={DSAR_URL}>data subject access request</A>, by emailing us at{' '}
              <A href={`mailto:${EMAIL}`}>{EMAIL}</A>, or by referring to the contact details at
              the bottom of this document.
            </P>
            <P>
              Under certain US state data protection laws, you can designate an authorized agent to
              make a request on your behalf. We may deny a request from an authorized agent that
              does not submit proof that they have been validly authorized to act on your behalf in
              accordance with applicable laws.
            </P>
          </Sub>
          <Sub title="Request Verification">
            <P>
              Upon receiving your request, we will need to verify your identity to determine you are
              the same person about whom we have the information in our system. We will only use
              personal information provided in your request to verify your identity or authority to
              make the request. However, if we cannot verify your identity from the information
              already maintained by us, we may request that you provide additional information for
              the purposes of verifying your identity and for security or fraud-prevention purposes.
            </P>
            <P>
              If you submit the request through an authorized agent, we may need to collect
              additional information to verify your identity before processing your request and the
              agent will need to provide a written and signed permission from you to submit such
              request on your behalf.
            </P>
          </Sub>
          <Sub title="Appeals">
            <P>
              Under certain US state data protection laws, if we decline to take action regarding
              your request, you may appeal our decision by emailing us at{' '}
              <A href={`mailto:${EMAIL}`}>{EMAIL}</A>. We will inform you in writing of any action
              taken or not taken in response to the appeal, including a written explanation of the
              reasons for the decisions. If your appeal is denied, you may submit a complaint to
              your state attorney general.
            </P>
          </Sub>
          <Sub title='California "Shine The Light" Law'>
            <P>
              California Civil Code Section 1798.83, also known as the "Shine The Light" law,
              permits our users who are California residents to request and obtain from us, once a
              year and free of charge, information about categories of personal information (if any)
              we disclosed to third parties for direct marketing purposes and the names and
              addresses of all third parties with which we shared personal information in the
              immediately preceding calendar year. If you are a California resident and would like
              to make such a request, please submit your request in writing to us by using the
              contact details provided in the section{' '}
              <A href="#contact">How Can You Contact Us About This Notice?</A>
            </P>
          </Sub>
        </Section>

        {/* 10. Updates */}
        <Section id="policyupdates" title="10. Do We Make Updates to This Notice?">
          <P>
            <em>
              <strong>In Short:</strong> Yes, we will update this notice as necessary to stay
              compliant with relevant laws.
            </em>
          </P>
          <P>
            We may update this Privacy Notice from time to time. The updated version will be
            indicated by an updated "Revised" date at the top of this Privacy Notice. If we make
            material changes to this Privacy Notice, we may notify you either by prominently posting
            a notice of such changes or by directly sending you a notification. We encourage you to
            review this Privacy Notice frequently to be informed of how we are protecting your
            information.
          </P>
        </Section>

        {/* 11. Contact */}
        <Section id="contact" title="11. How Can You Contact Us About This Notice?">
          <P>
            If you have questions or comments about this notice, you may email us at{' '}
            <A href={`mailto:${EMAIL}`}>{EMAIL}</A> or contact us by post at:
          </P>
          <address className="not-italic text-sm text-white/55 leading-relaxed pl-4 border-l border-white/10">
            Bridge<br />
            10058 Cartgate Ct<br />
            Dublin, OH 43017<br />
            United States
          </address>
        </Section>

        {/* 12. Review/delete */}
        <Section id="request" title="12. How Can You Review, Update, or Delete the Data We Collect From You?">
          <P>
            Based on the applicable laws of your country or state of residence in the US, you may
            have the right to request access to the personal information we collect from you,
            details about how we have processed it, correct inaccuracies, or delete your personal
            information. You may also have the right to withdraw your consent to our processing of
            your personal information. These rights may be limited in some circumstances by
            applicable law. To request to review, update, or delete your personal information,
            please fill out and submit a{' '}
            <A href={DSAR_URL}>data subject access request</A>.
          </P>
        </Section>

        <p className="text-xs text-white/25 mt-12 border-t border-white/10 pt-6">
          This Privacy Policy was created using{' '}
          <A href="https://termly.io/products/privacy-policy-generator/">Termly's Privacy Policy Generator</A>.
        </p>
      </div>
    </div>
  )
}
