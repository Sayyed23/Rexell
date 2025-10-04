import Link from "next/link";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LandingProductFeature } from "@/components/landing/LandingProductFeature";
import { LandingProductFeatureKeyPoints } from "@/components/landing/LandingProductFeatureKeyPoints";
import { LandingPrimaryImageCtaSection } from "@/components/landing/cta/LandingPrimaryCta";
import { LandingTestimonialGrid } from "@/components/landing/testimonial/LandingTestimonialGrid";
import { LandingTestimonialInline } from "@/components/landing/testimonial/LandingTestimonialInline";
import { LandingTestimonialInlineItem } from "@/components/landing/testimonial/LandingTestimonialInlineItem";
import { Button } from "@/components/shared/ui/button";

const keyPoints = [
  {
    title: "Decentralized",
    description: "Rexell is built on top of web3.0.",
  },
  {
    title: "Secure",
    description: "We use the latest security standards.",
  },
  {
    title: "Support",
    description:
      "24/7 customer support. We are here to help you at any time of the day. Just ask.",
  },
];

const testimonialItems = [
  {
    name: "Parl Coppa",
    text: "I love it!",
    handle: "@coppalipse",
    imageSrc: "https://picsum.photos/100/100.webp?random=1",
  },
  {
    name: "Joshua",
    text: "Perfect for my use case",
    handle: "@joshua",
    imageSrc: "https://picsum.photos/100/100.webp?random=3",
  },
  {
    name: "Mathew",
    text: "After using this, I cannot imagine going back to any other events platform.",
    handle: "@heymatt_oo",
    imageSrc: "https://picsum.photos/100/100.webp?random=2",
    featured: true, // Feature this testimonial
  },
  {
    name: "Mandy",
    text: "Excellent product!",
    handle: "@mandy",
    imageSrc: "https://picsum.photos/100/100.webp?random=4",
  },
  {
    name: "Alex",
    text: "Can easily recommend!",
    handle: "@alex",
    imageSrc: "https://picsum.photos/100/100.webp?random=5",
  },
  {
    name: "Sam",
    text: "This is what we event organizers needed.",
    handle: "@sama",
    imageSrc: "https://picsum.photos/100/100.webp?random=6",
  },
];

export default function Page() {

  return (
    <main className="flex flex-col">
      <Header />

      <LandingPrimaryImageCtaSection
        title="Discover top events near you"
        description="Rexell is the leading web3 platform for events. Enjoy secure, decentralized ticketing and resale capabilities."
        imageSrc="/static/images/concert/concert-1.jpg"
        imageAlt="Concert image"
        withBackground
        footerComponent={
          <LandingTestimonialInline>
            <LandingTestimonialInlineItem
              imageSrc="/static/images/people/1.webp"
              name="John Doe"
              text="I love this app"
            />

            <LandingTestimonialInlineItem
              imageSrc="/static/images/people/2.webp"
              name="Kim"
              text="Best app on the market"
            />

            <LandingTestimonialInlineItem
              imageSrc="/static/images/people/3.webp"
              name="Matt"
              text="Never seen anything like it"
              suffix="CEO of Metamask"
            />

            <LandingTestimonialInlineItem
              imageSrc="/static/images/people/5.webp"
              name="Guido Ross"
              text="The future of events is here"
              suffix="DevOps at Binance"
            />
          </LandingTestimonialInline>
        }
      >
        <Button size="xl" asChild>
          <Link href="/create-event">Create Event</Link>
        </Button>

        <Button size="xl" variant="outlinePrimary">
          <Link href="/events">Upcoming Events</Link>
        </Button>
      </LandingPrimaryImageCtaSection>

      <LandingProductFeature
        title="Blockchain-Powered Ticketing"
        descriptionComponent={
          <>
            <LandingProductFeatureKeyPoints
              className="mb-8"
              keyPoints={keyPoints}
            />
          </>
        }
        imageSrc="/static/images/concert/concert-3.jpg"
        imageAlt="Concert image"
        imagePosition="left"
        imagePerspective="none"
      />

      <LandingTestimonialGrid
        title="Don't take it from us"
        description="See what 120k event organizers have to say about our product."
        testimonialItems={testimonialItems}
        withBackground
        withBackgroundGlow
      />

      <Footer showText />
    </main>
  );
}
