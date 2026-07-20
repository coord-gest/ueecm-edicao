import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";
import type { Post } from "@/data/mock";
import heroImg from "@/assets/hero-school.jpg";

export function HeroCarousel({ posts }: { posts: Post[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  if (posts.length === 0) return null;

  return (
    <section className="relative overflow-hidden">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[Autoplay({ delay: 6000, stopOnInteraction: true })]}
        className="w-full"
      >
        <CarouselContent>
          {posts.map((p) => (
            <CarouselItem key={p.id}>
              <div className="relative h-[70vh] max-h-[560px] min-h-[440px] bg-black sm:h-[520px] sm:min-h-0 sm:max-h-none">
                {/* Fundo desfocado com a mesma imagem para preencher as laterais */}
                <img
                  src={p.imagem ?? heroImg}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 size-full scale-110 object-cover blur-2xl opacity-60"
                />
                {/* Imagem principal 100% visível */}
                <img
                  src={p.imagem ?? heroImg}
                  alt={p.titulo}
                  className="ken-burns absolute inset-0 size-full object-cover sm:object-contain"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10 sm:h-2/3 sm:top-auto sm:bg-gradient-to-t sm:from-black/85 sm:via-black/45 sm:to-transparent" />

                <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-16 sm:px-6 sm:pb-16">
                  <Badge className="animate-float mb-3 w-fit rounded-full bg-gold/90 text-gold-foreground shadow-elegant hover:bg-gold sm:mb-4">
                    <Star className="size-3.5" /> Destaque
                  </Badge>
                  <h2 className="max-w-3xl font-display text-xl font-semibold leading-tight text-white drop-shadow-md sm:text-4xl line-clamp-3">
                    {p.titulo}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-white/85 line-clamp-2 sm:mt-3 sm:text-base">
                    {p.resumo}
                  </p>
                  <div className="mt-4 sm:mt-6">
                    <Button
                      asChild
                      className="sheen rounded-full bg-gold text-gold-foreground shadow-elegant transition-transform hover:-translate-y-0.5 hover:bg-gold/90 sm:h-11 sm:px-8 sm:text-base"
                    >
                      <Link to="/posts/$id" params={{ id: p.id }}>
                        Ler matéria{" "}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {posts.length > 1 && (
          <>
            <CarouselPrevious className="left-4 hidden sm:flex" />
            <CarouselNext className="right-4 hidden sm:flex" />
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-4">
              {posts.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => api?.scrollTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-8 bg-gold" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </Carousel>
    </section>
  );
}
