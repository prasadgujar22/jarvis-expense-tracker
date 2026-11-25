import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { navigate } from '../router';

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="That page doesn't exist. Let's get you back to your money."
      action={
        <Button variant="primary" onClick={() => navigate('/')}>
          Go to dashboard
        </Button>
      }
    />
  );
}
