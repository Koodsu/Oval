import { useEffect } from 'react'

const EMAIL = 'contactus@theovalapp.com'
const EFFECTIVE_DATE = 'August 5, 2026'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-semibold uppercase tracking-widest text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/60">{children}</div>
    </section>
  )
}

function List({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function Mail() {
  return (
    <a className="text-scarlet underline underline-offset-2" href={`mailto:${EMAIL}`}>
      {EMAIL}
    </a>
  )
}

function Callout({ children }) {
  return (
    <div className="mb-12 rounded-lg border border-scarlet/40 bg-scarlet/5 px-5 py-4 text-sm font-semibold uppercase leading-relaxed tracking-wide text-white/80">
      {children}
    </div>
  )
}

export default function TermsOfUse() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Terms of Use | Oval'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-ink pb-24 pt-20">
      <article className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <div className="mb-8">
          <h1 className="mb-2 font-display text-3xl uppercase tracking-widest text-white">
            Terms of Use
          </h1>
          <p className="text-sm text-white/35">Effective {EFFECTIVE_DATE}</p>
        </div>

        <Callout>
          Please read these Terms carefully. Section 17 contains a binding arbitration agreement and
          a class action waiver that affect your legal rights, including your right to sue in court
          and to participate in a class action. You may opt out of arbitration within 30 days as
          described in that section. Section 7 describes risks of meeting other users in person and
          includes a release of claims.
        </Callout>

        <Section id="agreement" title="1. Agreement">
          <p>
            These Terms of Use ("Terms") govern your use of the Oval mobile app, theovalapp.com, and
            related services (collectively, "Oval" or the "Service") operated by Oval Technologies
            LLC, an Ohio limited liability company ("we," "us," "our"). By creating an account,
            checking a box indicating acceptance, or using the Service, you agree to these Terms,
            the Privacy Policy, and the Community Guidelines, which are incorporated by reference.
            If you do not agree, do not use Oval.
          </p>
          <p>
            You are entering into a binding contract with Oval Technologies LLC. If you accept these
            Terms on behalf of a student organization or other group, you represent that you have
            authority to bind it.
          </p>
        </Section>

        <Section id="eligibility" title="2. Eligibility And Accounts">
          <List items={[
            'You must be at least 18 years old and legally able to enter into a binding contract. Oval is not directed to anyone under 18 and we do not knowingly permit minors to register.',
            'An Oval account requires an eligible OSU email address. Email verification confirms control of that address only. It is not a verification of identity, current enrollment, character, criminal history, or fitness to interact with others.',
            'Provide accurate information, keep your credentials secure, and promptly tell us about unauthorized account use. You are responsible for activity that occurs under your account.',
            'You may not impersonate another person, create an account for someone else, maintain more than one account without our permission, evade a suspension or ban, or use Oval for unlawful activity.',
            'You may not use Oval if you have previously been removed for a safety violation, or if you are barred from using the Service under applicable law.',
          ]} />
        </Section>

        <Section id="service" title="3. The Service">
          <p>
            Oval provides tools for campus profiles, activity pods, clubs, messaging, invitations,
            attendance, notifications, and coordinating in-person plans. Oval is a neutral venue and
            communications platform. We do not organize, host, sponsor, supervise, staff, insure, or
            participate in any meetup, event, or interaction arranged through the Service.
          </p>
          <p>
            Features may change, be limited, suspended, or discontinued at any time, with or without
            notice. We do not guarantee that the Service, or any particular feature, will remain
            available.
          </p>
          <p>
            Oval is an independent service. It is not affiliated with, sponsored by, endorsed by, or
            officially connected to The Ohio State University, and references to OSU are for
            identification and eligibility purposes only.
          </p>
        </Section>

        <Section id="content" title="4. Your Content">
          <p>
            You retain ownership of content you submit ("User Content"). You grant Oval a
            nonexclusive, worldwide, royalty-free, sublicensable (solely to our service providers)
            license to host, store, copy, display, transmit, format, adapt for display, moderate, and
            remove that content as reasonably needed to operate, secure, improve, and promote the
            Service. This license ends when the content is deleted, except for limited backups, legal
            obligations, and retained safety records described in the Privacy Policy, and except for
            copies others have already received or reshared.
          </p>
          <p>
            You represent and warrant that you own or have all rights necessary to submit your User
            Content and to grant this license, and that your User Content does not violate any law,
            any third party's rights, or the Community Guidelines.
          </p>
          <p>
            You are solely responsible for your User Content. We do not endorse, verify, or adopt any
            User Content, and we have no obligation to monitor, store, or preserve it.
          </p>
        </Section>

        <Section id="conduct" title="5. Acceptable Use And Zero Tolerance">
          <p>
            <span className="font-semibold text-white/80">
              We maintain a zero-tolerance policy for objectionable content and abusive users.
            </span>{' '}
            Content that violates this section may be removed, and the accounts responsible may be
            terminated, without notice and at our sole discretion. We aim to review reports of
            objectionable content and act on them within 24 hours.
          </p>
          <p>You may not, and may not permit anyone else to:</p>
          <List items={[
            'Harass, threaten, bully, exploit, discriminate against, stalk, or expose private information about another person.',
            'Post illegal, infringing, defamatory, deceptive, obscene, sexually explicit or exploitative, hateful, violent, or malicious content.',
            'Solicit or facilitate commercial sex, human trafficking, weapons or drug transactions, gambling, or any other unlawful activity.',
            'Spam, scrape, crawl, probe, reverse engineer, decompile, disrupt, overload, circumvent security or rate limits, or gain unauthorized access to Oval, its infrastructure, or another account.',
            'Use bots or automated systems to create accounts, collect data, send messages, or manipulate attendance, reports, or reliability information.',
            'Misrepresent a meetup, club, affiliation, identity, age, location, or safety condition.',
            'Use the Service for commercial solicitation, recruiting, political canvassing, or research studies without our prior written permission.',
            'Encourage or enable anyone else to do any of the above.',
          ]} />
        </Section>

        <Section id="interactions" title="6. Interactions With Other Users">
          <p>
            You are solely responsible for your interactions with other users. We do not conduct
            criminal background checks or identity verification on users, and we make no
            representation about any user's identity, background, conduct, intentions, statements, or
            suitability. Reliability information, attendance history, and profile details are
            supplied by users and may be inaccurate.
          </p>
        </Section>

        <Section id="meetups" title="7. In-Person Plans, Assumption Of Risk, And Release">
          <p>
            Oval helps users coordinate plans; it does not organize, supervise, endorse, insure, or
            conduct meetups, and no Oval representative attends them.
          </p>
          <p className="font-semibold text-white/80">
            You acknowledge that meeting other people in person carries inherent risks, including the
            risk of bodily injury, illness, emotional distress, property damage, theft, harassment,
            assault, and death. You knowingly and voluntarily assume all such risks, whether or not
            caused by another user's negligence or intentional conduct.
          </p>
          <p>
            To the fullest extent permitted by law, you release, waive, and discharge Oval
            Technologies LLC and its members, officers, employees, contractors, and agents (the
            "Released Parties") from any and all claims, demands, damages, losses, costs, and causes
            of action of every kind, known or unknown, arising out of or relating to your
            interactions with other users, your participation in any meetup or event, or any content
            or conduct of any user, whether occurring online or offline. This release does not apply
            to claims that cannot be released under applicable law, including claims arising from our
            own gross negligence, willful misconduct, or fraud.
          </p>
          <p>
            Use good judgment. Meet in public places, tell someone where you are going, arrange your
            own transportation, and leave if a situation feels unsafe. Oval is not an emergency
            service and does not monitor the Service in real time. In an emergency, call 911 or the
            appropriate local authority. OSU campus safety resources are available to eligible
            students independently of Oval.
          </p>
        </Section>

        <Section id="moderation" title="8. Moderation And Enforcement">
          <p>
            We may, but are not obligated to, review reports, use automated and human moderation,
            remove or restrict content, limit features, revoke sessions, suspend or terminate
            accounts, and preserve limited safety records when reasonably necessary to enforce these
            Terms, protect users, prevent ban evasion, or comply with law. We are not required to
            host any content and may act without prior notice.
          </p>
          <p>
            You can report users, messages, clubs, announcements, and pod behavior inside the app,
            and you can block other users. Abuse of the reporting tools is itself a violation.
          </p>
          <p>
            Email <Mail /> to appeal an account action. We may ask for information needed to review
            the appeal, and our decision on appeal is final.
          </p>
        </Section>

        <Section id="dmca" title="9. Copyright And DMCA">
          <p>
            We respect intellectual property rights and will remove infringing material in
            appropriate circumstances. If you believe content on Oval infringes your copyright, send
            a written notice to our designated agent at <Mail /> with the subject line "DMCA Notice,"
            including:
          </p>
          <List items={[
            'Your physical or electronic signature.',
            'Identification of the copyrighted work you claim has been infringed.',
            'Identification of the material claimed to be infringing and information reasonably sufficient to let us locate it.',
            'Your name, address, telephone number, and email address.',
            'A statement that you have a good faith belief the use is not authorized by the copyright owner, its agent, or the law.',
            'A statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on the owner’s behalf.',
          ]} />
          <p>
            We will respond to valid counter-notices in accordance with 17 U.S.C. § 512(g), and we
            terminate the accounts of repeat infringers in appropriate circumstances. Notices that
            knowingly misrepresent infringement may result in liability under 17 U.S.C. § 512(f).
          </p>
        </Section>

        <Section id="communications" title="10. Communications And Electronic Records">
          <p>
            You consent to receive communications from us electronically, and you agree that
            electronic notices, agreements, and records satisfy any legal requirement that such
            communications be in writing. You agree to receive transactional messages needed to
            operate your account, including verification, password reset, security, moderation, and
            service notices, which you cannot opt out of while your account is active. Marketing and
            waitlist email may be unsubscribed from at any time. You can manage optional push
            notifications in Oval and in iOS settings.
          </p>
        </Section>

        <Section id="ip" title="11. Oval Property">
          <p>
            Oval's software, branding, logos, design, and Service content, excluding User Content,
            are owned by Oval Technologies LLC or its licensors and protected by intellectual
            property law. These Terms grant you a limited, personal, revocable, nontransferable,
            nonsublicensable license to use the Service as intended, and reserve all rights not
            expressly granted.
          </p>
          <p>
            If you send us feedback, suggestions, or ideas about the Service, you grant us an
            unrestricted, perpetual, royalty-free right to use them without obligation or
            compensation to you.
          </p>
        </Section>

        <Section id="third-party" title="12. Third-Party Services And Links">
          <p>
            The Service may display links or handles pointing to third-party services, including
            Instagram and club websites, and relies on third-party providers described in the Privacy
            Policy. We do not control and are not responsible for third-party services, their
            content, or their privacy and security practices. Your use of them is governed by their
            terms, at your own risk.
          </p>
        </Section>

        <Section id="indemnity" title="13. Indemnification">
          <p>
            To the fullest extent permitted by law, you agree to defend, indemnify, and hold harmless
            the Released Parties from and against any claims, demands, actions, damages, losses,
            liabilities, judgments, settlements, costs, and expenses, including reasonable attorneys'
            fees, arising out of or relating to: (a) your use of the Service; (b) your User Content;
            (c) your violation of these Terms, the Community Guidelines, or applicable law; (d) your
            violation of any third party's rights; or (e) your interactions with other users,
            including any meetup or event. We reserve the right to assume the exclusive defense and
            control of any matter subject to indemnification by you, and you agree to cooperate with
            our defense. You may not settle any matter in a way that imposes obligations on us
            without our prior written consent.
          </p>
        </Section>

        <Section id="termination" title="14. Termination">
          <p>
            You may stop using Oval at any time and delete your account in Settings. We may suspend
            or terminate your access, with or without notice, for violations of these Terms, safety
            risks, legal requirements, extended inactivity, discontinuation of the Service, or
            conduct that materially harms Oval or its users. On termination, your license to use the
            Service ends immediately. Sections that by their nature should survive, including
            Sections 4, 7, 11, 13, 15, 16, 17, 18, and 23, survive termination.
          </p>
        </Section>

        <Section id="disclaimers" title="15. Disclaimers">
          <p>
            To the fullest extent permitted by law, the Service is provided "as is" and "as
            available," with all faults and without warranty of any kind. We disclaim all warranties,
            express, implied, and statutory, including merchantability, fitness for a particular
            purpose, title, non-infringement, and any warranties arising from course of dealing or
            usage of trade.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, timely, secure, or error-free,
            that defects will be corrected, that data will not be lost, or that the Service is free
            of harmful components. We make no warranty regarding any user's conduct or identity, the
            accuracy or reliability of User Content, the outcome or safety of any meetup, or the
            results of using the Service. No advice or information obtained from us creates any
            warranty not expressly stated here.
          </p>
        </Section>

        <Section id="liability" title="16. Limitation Of Liability">
          <p>
            To the fullest extent permitted by law, the Released Parties will not be liable for any
            indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost
            profits, lost data, loss of goodwill, business interruption, personal injury, or
            emotional distress, arising out of or relating to the Service, whether based in contract,
            tort, strict liability, or any other theory, and whether or not we have been advised of
            the possibility of such damages.
          </p>
          <p>
            To the fullest extent permitted by law, the total aggregate liability of the Released
            Parties for all claims relating to the Service will not exceed the greater of one hundred
            U.S. dollars ($100) or the total amount you paid us in the twelve months before the event
            giving rise to the claim.
          </p>
          <p>
            These limitations are an essential basis of the bargain between you and us and apply even
            if a limited remedy fails of its essential purpose. Some jurisdictions do not allow the
            exclusion of certain warranties or the limitation of certain damages, so some of these
            exclusions may not apply to you, in which case our liability is limited to the greatest
            extent permitted by law.
          </p>
        </Section>

        <Section id="arbitration" title="17. Dispute Resolution And Arbitration">
          <p className="font-semibold text-white/80">
            Please read this section carefully. It requires most disputes to be resolved by
            individual binding arbitration instead of in court, and it waives your right to a jury
            trial and to participate in a class action.
          </p>
          <p>
            <span className="font-semibold text-white/80">Informal resolution first.</span> Before
            starting arbitration, you agree to email <Mail /> with a description of the dispute and
            the relief you seek, and to work with us in good faith to resolve it for at least 60
            days. This step is a condition of starting arbitration.
          </p>
          <p>
            <span className="font-semibold text-white/80">Agreement to arbitrate.</span> If we cannot
            resolve the dispute informally, you and Oval agree that any dispute, claim, or
            controversy arising out of or relating to these Terms or the Service will be resolved by
            final and binding individual arbitration administered by the American Arbitration
            Association under its Consumer Arbitration Rules, rather than in court. The Federal
            Arbitration Act governs the interpretation and enforcement of this section. The
            arbitration will take place in Franklin County, Ohio, or by telephone or video at your
            election, and the arbitrator may award any relief a court could award to you
            individually.
          </p>
          <p>
            <span className="font-semibold text-white/80">Class action waiver.</span> You and Oval
            agree to bring claims only in an individual capacity, and not as a plaintiff or class
            member in any purported class, collective, consolidated, or representative proceeding.
            The arbitrator may not consolidate claims or preside over any form of representative
            proceeding. If this waiver is found unenforceable as to a particular claim, that claim
            must proceed in court and is severed from arbitration.
          </p>
          <p>
            <span className="font-semibold text-white/80">Exceptions.</span> Either party may bring
            an individual claim in small claims court if it qualifies, and either party may seek
            injunctive relief in court for infringement or misuse of intellectual property. Nothing
            here prevents you from reporting conduct to a government agency.
          </p>
          <p>
            <span className="font-semibold text-white/80">Your right to opt out.</span> You may opt
            out of this arbitration agreement by emailing <Mail /> with the subject line "Arbitration
            Opt-Out," including your name and the email address on your account, within 30 days of
            first accepting these Terms. Opting out does not affect any other part of these Terms and
            will not affect your account or use of the Service.
          </p>
          <p>
            If any portion of this section other than the class action waiver is found
            unenforceable, that portion is severed and the remainder continues to apply. This section
            survives termination of your account.
          </p>
        </Section>

        <Section id="law" title="18. Governing Law And Venue">
          <p>
            Ohio law governs these Terms and any dispute between us, without regard to conflict-of-law
            rules, except that the Federal Arbitration Act governs Section 17. For any dispute not
            subject to arbitration, you and Oval agree to the exclusive jurisdiction and venue of the
            state and federal courts serving Franklin County, Ohio, and each party waives any
            objection to that venue and any right to a jury trial.
          </p>
        </Section>

        <Section id="apple" title="19. Apple App Store">
          <p>
            The following applies to the iOS app obtained through the Apple App Store. These Terms
            are between you and Oval Technologies LLC only, not Apple. Apple has no obligation to
            provide maintenance or support for the app. If the app fails to conform to any applicable
            warranty, you may notify Apple, and Apple may refund the purchase price, if any; to the
            maximum extent permitted by law, Apple has no other warranty obligation with respect to
            the app. Apple is not responsible for addressing any claim by you or a third party
            relating to the app, including product liability, legal or regulatory compliance, or
            consumer protection claims, or for investigating or resolving any third-party
            intellectual property claim. You represent that you are not located in a country subject
            to a U.S. Government embargo or designated as terrorist-supporting, and that you are not
            on any U.S. Government restricted-parties list. Apple and its subsidiaries are
            third-party beneficiaries of these Terms and may enforce them against you.
          </p>
        </Section>

        <Section id="fees" title="20. Fees">
          <p>
            Oval is currently free to use. We may introduce fees or paid features in the future. Any
            fees will apply prospectively, we will give reasonable advance notice, and we will not
            charge you for paid features without your express consent. Continued use of free features
            will remain free unless we notify you otherwise.
          </p>
        </Section>

        <Section id="force-majeure" title="21. Force Majeure">
          <p>
            We are not liable for any delay or failure to perform resulting from causes beyond our
            reasonable control, including acts of God, natural disasters, epidemics, war, terrorism,
            civil unrest, labor disputes, governmental action, power or internet failures, or the
            failure of third-party hosting, storage, email, or push-notification providers.
          </p>
        </Section>

        <Section id="changes" title="22. Changes To These Terms">
          <p>
            We may update these Terms. We will change the effective date above and, for material
            changes, provide reasonable notice and may require you to accept the new version before
            continuing to use the Service. Changes apply prospectively from the stated effective
            date. Your continued use after the effective date constitutes acceptance.
          </p>
        </Section>

        <Section id="general" title="23. General">
          <p>
            If any provision is held unenforceable, it will be limited or severed to the minimum
            extent necessary and the remaining provisions will remain in full force. Our failure to
            enforce a provision is not a waiver of it. You may not assign or transfer these Terms
            without our prior written consent; we may assign them in connection with a merger,
            acquisition, or sale of assets. There are no third-party beneficiaries to these Terms
            except as stated in Section 19. These Terms, the Privacy Policy, and the Community
            Guidelines are the entire agreement between you and us regarding the Service and
            supersede any prior agreements. Any claim relating to the Service must be filed within
            one year after it arises, to the extent permitted by law, or it is permanently barred.
          </p>
        </Section>

        <Section id="contact" title="24. Contact">
          <p>
            Oval Technologies LLC, Columbus, Ohio. Questions about these Terms can be sent to{' '}
            <Mail />.
          </p>
        </Section>
      </article>
    </main>
  )
}
