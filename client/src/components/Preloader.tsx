import { motion } from 'framer-motion';

interface PreloaderProps {
  logoUrl?: string;
  universityName?: string;
}

export function Preloader({ logoUrl, universityName = 'Loading...' }: PreloaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background" data-testid="preloader">
      <div className="flex flex-col items-center gap-6">
        {logoUrl ? (
          <motion.img
            src={logoUrl}
            alt={universityName}
            className="h-20 object-contain"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          />
        ) : (
          <motion.div
            className="text-2xl font-bold text-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {universityName}
          </motion.div>
        )}
        
        <div className="flex items-center gap-2">
          <motion.div
            className="h-3 w-3 rounded-full bg-primary"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0,
            }}
          />
          <motion.div
            className="h-3 w-3 rounded-full bg-primary"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0.2,
            }}
          />
          <motion.div
            className="h-3 w-3 rounded-full bg-primary"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0.4,
            }}
          />
        </div>
      </div>
    </div>
  );
}
