import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* AWS Setup Notice */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow flex flex-col gap-2 mb-4">
        <h2 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
          AWS Setup Required
        </h2>
        <p className="text-yellow-700 text-sm">
          This application requires AWS services (S3, Transcribe) to run. <br className="hidden sm:block" />
          <span className="font-medium">Note:</span> Running this app may incur AWS costs. Please ensure you have set up your AWS credentials and resources as described in the <a href="https://docs.aws.amazon.com/" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 hover:text-blue-900">AWS setup documentation</a> before using the features.
        </p>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Call Insights</h1>
        <p className="text-muted-foreground">
          Enhance your call center operations with AI-powered insights and tools.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>AI Chatbot</CardTitle>
            <CardDescription>
              Interact with our AI assistant for instant support and insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/chatbot">Start Chat</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Manager</CardTitle>
            <CardDescription>
              Manage and analyze your training data for better AI performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/data-manager">Train Data</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Simulator</CardTitle>
            <CardDescription>
              Practice and analyze simulated customer interactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/call-simulator">Start Simulation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Recent Activities</h2>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Latest Interactions</CardTitle>
              <CardDescription>Your recent interactions and transcriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="text-sm">AI Chat Session - 2 mins ago</li>
                <li className="text-sm">Voice Transcription - 15 mins ago</li>
                <li className="text-sm">Call Simulation - 1 hour ago</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 